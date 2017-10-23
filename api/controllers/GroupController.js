const _ = require("lodash");

module.exports = {
	getGroupsByQueue: (req, res) => {
    QueueGroup.find({
      queue: req.param("queueId")
    }).sort("position ASC").populate("group")
    .then(queueGroups => {
      if (req.isSocket) {
        QueueGroup.subscribe(req, _.map(queueGroups, "id"));
        QueueGroup.watch(req);
        Group.subscribe(req, _.map(_.map(queueGroups, "group"), "id"));
        Group.watch(req);
      }
      res.json(queueGroups);
    });
  },
  addGroup: (req, res) => {
    if (! req.param("name") || ! req.param("phoneNumber") || ! req.param("groupSize") || ! req.param("queueOrder")) {
      return req.badRequest();
    }
    let name = req.param("name");
    let phoneNumber = req.param("phoneNumber");
    let groupSize = req.param("groupSize");
    let queueOrder = req.param("queueOrder");
    Group.create({
      name,
      phoneNumber,
      groupSize,
    }).then(group => {
      let nextQueueGroup = null;
      let queueIds = _.reverse(queueOrder);
      async.eachOfSeries(queueIds, (queueId, i, callback) => {
        Queue.findOne(queueId).then(queue => {
          if (! queue) {
            return callback(null);
          }
          Queue.nextPositionIndex(queue).then(positionIndex => {
            QueueGroup.create({
              pending: (i !== queueIds.length - 1), // 1st (last in queueIds) one not pending, all subsequent ones are pending
              position: positionIndex,
              queue: queueId,
              group: group.id,
              next: nextQueueGroup,
            })
            .then(queueGroup => {
              nextQueueGroup = queueGroup.id;
              queueGroup.group = group; // Populate group
              QueueGroup.publishCreate(queueGroup);
              Queue.publishAdd(queueId, "groups", queueGroup);
              callback(null);
            })
            .catch(err => {
              callback(err);
            });
          });
        });
      }, (err) => {
        if (err) {
          res.negotiate(err);
        }
        Group.publishCreate(group);
        res.json(group);
      });
    }).catch(err => {
      return res.negotiate(err);
    });
  },
  deleteGroup: (req, res) => {
    let id = req.param("id");
    Group.findOne(id)
    .then(group => {
      if (! group) {
        return res.notFound();
      }
      Group.destroy({ id })
      .then(groups => {
        Group.publishDestroy(id);
        QueueGroup.destroy({ group: id })
        .then(queueGroups => {
          _.forEach(queueGroups, queueGroup => {
            QueueGroup.publishDestroy(queueGroup.id);
            Queue.publishRemove(queueGroup.queue, "groups", queueGroup.id);
          });
        });
      })
      .catch(err => {
        return res.negotiate(err);
      });
    });
  }
};

