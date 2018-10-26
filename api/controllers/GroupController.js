const _ = require("lodash");
const async = require("async");

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
    if (! req.param("name") || ! req.param("groupSize") || ! req.param("queueOrder")) {
      return res.badRequest();
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
          // 1st (last in queueIds) one not pending, all subsequent ones are pending
          let isPending = (i !== queueIds.length - 1);
          Queue.nextPositionIndex(queue, isPending)
          .then(positionIndex => {
            QueueGroup.create({
              pending: isPending,
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
          })
          .catch(err => {
            callback(err)
          });
        });
      }, (err) => {
        if (err) {
          return res.negotiate(err);
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
          res.json(groups);
        });
      })
      .catch(err => {
        return res.negotiate(err);
      });
    });
  },
  updateGroup: (req, res) => {
    let id = req.param("id"),
      name = req.param("name"),
      phoneNumber = req.param("phoneNumber"),
      groupSize = req.param("groupSize");
    let newGroup = {};
    if (name) newGroup.name = name;
    if (phoneNumber) newGroup.phoneNumber = phoneNumber;
    if (groupSize) newGroup.groupSize = groupSize;
    Group.update({ id }, newGroup)
    .then(groups => {
      Group.publishUpdate(groups[0].id, groups[0]);
      res.json(groups);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  nextQueue: (req, res) => {
    let id = req.param("id");
    QueueGroup.find({
      group: id,
      pending: false,
      completed: false,
    })
    .then(queueGroups => {
      if (queueGroups.length > 1) {
        return res.serverError("More than one queueGroup for that group");
      }
      if (queueGroups.length === 0) {
        return res.notFound("Group doesn't exist, or is not concrete or is completed");
      }
      let currentQueueGroup = queueGroups[0];
      QueueGroup.update({ id: currentQueueGroup.id }, {
        completed: true,
      })
      .then(updatedQueueGroup => {
        QueueGroup.resolvePlaceholder(currentQueueGroup.id.toString())
        .then(placeholder => {
          QueueGroup.publishUpdate(currentQueueGroup.id, {
            id: currentQueueGroup.id,
            queue: currentQueueGroup.queue,
            completed: true,
          });
          if (placeholder) {
            QueueGroup.publishUpdate(placeholder.id, {
              id: placeholder.id,
              queue: placeholder.queue,
              pending: false,
            });
          }
          return res.json([placeholder]);
        })
        .catch(err => {
          return res.negotiate(err);
        });
      })
      .catch(err => {
        return res.negotiate(err);
      });
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  getMovableQueueGroups: async (req, res) => {
    let groupId = req.param("id");
    try {
      let group = await Group.findOne(groupId);
      if (! group) {
        return res.notFound();
      }
      let movableQueueGroups = await QueueGroup.find({
        group: groupId,
        completed: false,
        batch: [null, undefined],
      }).populate("queue");
      let ordered = [], current = _.find(movableQueueGroups, queueGroup => !queueGroup.pending);
      while (current) {
        ordered.push(current);
        current = _.find(movableQueueGroups, queueGroup => queueGroup.id === current.next);
      }
      return res.json(ordered);
    } catch(err) {
      return res.negotiate(err);
    }
  },
  removeQueueGroup: async (req, res) => {
    let groupId = req.param("groupId"), queueGroupId = req.param("queueGroupId");
    let queueGroups = await QueueGroup.find({ group: groupId });
    let removedQueueGroup = _.find(queueGroups, queueGroup => queueGroup.id == queueGroupId);
    let previousQueueGroup = _.find(queueGroups, queueGroup => queueGroup.next == removedQueueGroup.id);
    let nextQueueGroup = _.find(queueGroups, queueGroup => queueGroup.id == removedQueueGroup.next);

    try {
      if (! removedQueueGroup.pending) {
        // If this was a concrete group, then there might be a placeholder that needs to take over
        let updatedQueueGroup = await QueueGroup.resolvePlaceholder(removedQueueGroup);
        QueueGroup.publishUpdate(updatedQueueGroup.id, {
          id: updatedQueueGroup.id,
          queue: updatedQueueGroup.queue,
          pending: false,
        });
      }

      if (previousQueueGroup) {
        let newNext = null;
        if (nextQueueGroup) {
          newNext = nextQueueGroup.id;
        }
        await QueueGroup.update({
          id: previousQueueGroup.id,
        }, {
          next: newNext,
        });
        QueueGroup.publishUpdate(previousQueueGroup.id, {
          id: previousQueueGroup.id,
          queue: previousQueueGroup.queue,
          next: newNext,
        });
      }

      let destroyedQueueGroup = await QueueGroup.destroy({ id: queueGroupId });
      QueueGroup.publishDestroy(queueGroupId);
      Queue.publishRemove(removedQueueGroup.queue, "groups", queueGroupId);

      return res.json(destroyedQueueGroup);
    } catch(err) {
      return res.negotiate(err);
    }
  },
};

