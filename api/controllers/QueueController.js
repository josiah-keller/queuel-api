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
      Queue.publishUpdate(queues[0].id, queues[0]);
      res.json(queues);
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
  nextGroup: (req, res) => {
    let queueId = req.param("queueId");
    Queue.incrementQueue(queueId, 1)
    .then(updatedQueueGroups => {
      if (updatedQueueGroups.length === 0) {
        return res.json([]);
      }
      let currentQueueGroup = updatedQueueGroups[0];
      Queue.update({
        id: queueId,
      }, {
        status: "inProgress",
      })
      .then(updatedQueue => {
        Queue.publishUpdate(queueId, {
          id: queueId,
          status: "inProgress",
        });
        QueueGroup.resolvePlaceholder(currentQueueGroup.id.toString())
        .then(placeholder => {
          QueueGroup.publishUpdate(currentQueueGroup.id, {
            id: currentQueueGroup.id,
            queue: currentQueueGroup.queue,
            completed: currentQueueGroup.completed,
          });
          if (placeholder) {
            QueueGroup.publishUpdate(placeholder.id, {
              id: placeholder.id,
              queue: placeholder.queue,
              pending: false,
            });
          }
          QueueGroup.find({
            queue: queueId,
            completed: false,
          })
          .populate("group")
          .sort("position ASC")
          .then(queueGroups => {
            if (queueGroups.length < 2) {
              sails.log.warn(`No one to send text to`);
              return res.json([placeholder]);
            }
            let nextQueueGroup = queueGroups[1]; // Send text to next group, not current
            // Bail if pending
            if (nextQueueGroup.pending) {
              sails.log.warn(`Not texting placeholder`);
              return res.json([placeholder]);
            }
            Queue.findOne(queueId)
            .then(queue => {
              if (! queue) {
                sails.log.warn(`Couldn't send text because queue ${queueId} not found`);
                return res.json([placeholder]);
              }
              TextService
              .sendText("nextGroup", {
                groupName: nextQueueGroup.group.name,
                queueName: queue.name
              }, nextQueueGroup.group.phoneNumber)
              .then(() => {
                return res.json([placeholder]);
              })
              .catch(err => {
                sails.log.warn(`Couldn't send text because ${err}`);
              });
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
