const _ = require("lodash");

module.exports = {
	getQueues: (req, res) => {
    Queue.find().populate("groups").populate("currentBatch").populate("nextBatch")
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
  addQueue: async (req, res) => {
    if (! req.param("name")) {
      return res.badRequest();
    }
    let newQueue = {
      name: req.param("name"),
      backgroundImageUrl: req.param("backgroundImageUrl"),
      targetBatchSize: parseInt(req.param("targetBatchSize"), 10),
    };
    try {
      let queue = await Queue.create(newQueue);

      let currentBatch = await Batch.create({ queue: queue.id });
      let nextBatch = await Batch.create({ queue: queue.id });

      queue = await Queue.update({ id: queue.id }, { 
        currentBatch: currentBatch.id,
        nextBatch: nextBatch.id
      });

      queue.groups = [];
      Queue.publishCreate(queue);
      return res.json(queue);
    } catch(err) {
      return res.negotiate(err);
    }
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
  updateQueue: (req, res) => {
    let id = req.param("id"),
      name = req.param("name"),
      status = req.param("status"),
      backgroundImageUrl = req.param("backgroundImageUrl"),
      targetBatchSize = parseInt(req.param("targetBatchSize"), 10);
    let newQueue = {};
    if (name) newQueue.name = name;
    if (status) newQueue.status = status;
    if (backgroundImageUrl) newQueue.backgroundImageUrl = backgroundImageUrl;
    if (_.isInteger(targetBatchSize)) newQueue.targetBatchSize = targetBatchSize;
    Queue.update({
      id,
    }, newQueue)
    .then(queues => {
      Queue.findOne({ id: queues[0].id }).populate("groups").populate("currentBatch").populate("nextBatch")
        .then(updatedQueue => {
          Queue.publishUpdate(updatedQueue.id, updatedQueue);
          res.json(queues);
        }).catch(err => {
          return res.negotiate(err);
        });
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
  nextBatch: async (req, res) => {
    try {
      let queueId = req.param("queueId"),
        completedQueueGroupIds,
        queue,
        promises = [];

      // Advance queue
      completedQueueGroupIds = await Queue.advanceQueue(queueId);

      queue = await Queue.findOne({ id: queueId }).populate("currentBatch").populate("nextBatch");
      Batch.publishCreate(queue.nextBatch);
      Queue.publishUpdate(queue.id, {
        id: queue.id,
        currentBatch: queue.currentBatch,
        nextBatch: queue.nextBatch,
      });

      // Update queue status
      promises.push(Queue.update({
        id: queueId,
      }, {
        status: "inProgress",
      }).then(() => {
        Queue.publishUpdate(queueId, {
          id: queueId,
          status: "inProgress",
        });
      }));
      
      // If the old current batch was empty (eg, queue was new), no need to do anything else
      if (completedQueueGroupIds.length === 0) {
        await Promise.all(promises);
        return res.json(queue.nextBatch);
      }

      // Resolve placeholders
      promises = promises.concat(completedQueueGroupIds.map(id => {
        return QueueGroup.resolvePlaceholder(id.toString()).then(placeholder => {
          QueueGroup.publishUpdate(id, {
            id: id,
            queue: queue.id,
            completed: true,
          });
          if (placeholder) {
            QueueGroup.publishUpdate(placeholder.id, {
              id: placeholder.id,
              queue: placeholder.queue,
              pending: false,
            });
          }
        });
      }));

      await Promise.all(promises);

      return res.json(queue.nextBatch);
    } catch(err) {
      return res.negotiate(err);
    }
  },
};
