const _ = require("lodash");

module.exports = {
	getQueues: (req, res) => {
    Queue.find().populate("groups")
    .then(queues => {
      if (req.isSocket) {
        Queue.subscribe(req, _.map(queues, "id"));
        Queue.watch(req);
      }
      return res.json(queues);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  addQueue: (req, res) => {
    if (! req.param("name")) {
      return res.badRequest();
    }
    let newQueue = {
      name: req.param("name"),
    };
    Queue.create(newQueue)
    .then(queue => {
      queue.groups = [];
      Queue.publishCreate(queue);
      return res.json(queue);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  deleteQueue: (req, res) => {
    let id = req.param("id");
    Queue.destroy({ id })
    .then(queues => {
      Queue.publishDestroy(id);
      return res.json(queues);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  reorderGroup: (req, res) => {
    let queueId = req.param("queueId"),
      queueGroupId = req.param("queueGroupId"),
      index = _.parseInt(req.param("index"));
    if (! queueId || ! queueGroupId || ! _.isInteger(index)) {
      return res.badRequest();
    }
    QueueGroup.find({ queue: queueId })
    .sort("position ASC")
    .then(queueGroups => {
      let oldIndex = _.findIndex(queueGroups, queueGroup => queueGroup.id === queueGroupId);
      if (queueGroups.length === 0 || oldIndex === -1) {
        return res.notFound();
      }
      Queue.calculateNewPosition(queueId, oldIndex, index)
      .then(newPosition => {
        QueueGroup.update({
          id: queueGroupId,
        }, {
          position: newPosition,
        })
        .then(queueGroups => {
          QueueGroup.publishUpdate(queueGroups[0].id, {
            id: queueGroups[0].id,
            queue: queueGroups[0].queue,
            position: queueGroups[0].position,
          });
          return res.json(queueGroups[0]);
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
};
