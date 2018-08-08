const _ = require("lodash");
const async = require("async");
const POSITION_INCREMENT = 1000;

module.exports = {
  attributes: {
    name: {
      type: "string",
    },
    status: {
      type: "string",
      enum: ["open", "inProgress", "blocked"],
      defaultsTo: "open",
    },
    backgroundImageUrl: {
      type: "string",
      defaultsTo: null,
    },
    groups: {
      collection: "QueueGroup",
      via: "queue",
    },
    currentBatch: {
      model: "batch",
    },
    nextBatch: {
      model: "batch",
    },
    targetBatchSize: {
      type: "integer",
    },
  },

  getNthQueueGroup: (queue, n) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    if (! queueId) return Promise.reject(new Error("No queue specified"));

    return new Promise((resolve, reject) => {
      QueueGroup.find({
        queue: queueId,
      })
      .sort("position ASC")
      .populate("group")
      .then(queueGroups => {
        if (! queueGroups || queueGroups.length === 0 || ! queueGroups[n]) {
          return resolve(null);
        }
        resolve(queueGroups[n]);
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  calculateNewPosition: (queue, oldIndex, newIndex) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    if (! queueId) return Promise.reject(new Error("No queue specified"));

    return new Promise((resolve, reject) => {
      QueueGroup.find({
        queue: queueId,
      })
      .sort("position ASC")
      .then(queueGroups => {
        if (! queueGroups || queueGroups.length < 2) {
          return resolve(POSITION_INCREMENT);
        }
        // Simulate the array move in order to get the indices right
        let pulled = _.pullAt(queueGroups, oldIndex);
        queueGroups.splice(newIndex, 0, pulled[0]);
        if (newIndex === 0) {
          return resolve(queueGroups[1].position / 2);
        } else if (newIndex === queueGroups.length - 1) {
          return resolve(queueGroups[queueGroups.length - 2].position + POSITION_INCREMENT);
        } else {
          return resolve(
            ((queueGroups[newIndex + 1].position - queueGroups[newIndex - 1].position) / 2)
              + queueGroups[newIndex - 1].position
          );
        }
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  nextPositionIndex: async (queue) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    if (! queueId) throw new Error("No queue specified");
    
    let lastQueueGroup = await QueueGroup.find({
      queue: queueId,
      completed: false,
    }).sort("position DESC").limit(1);

    if (! lastQueueGroup || lastQueueGroup.length !== 1) {
      return POSITION_INCREMENT;
    }

    return lastQueueGroup[0].position + POSITION_INCREMENT;
  },

  advanceQueue: async (id) => {
    let queue = await Queue.findOne({ id, }),
      currentBatch = await Batch.findOne({ id: queue.currentBatch, }).populate("groups"),
      promises = [];
    
    // Mark all the current batch groups completed
    promises = promises.concat(currentBatch.groups.map(queueGroup => {
      return QueueGroup.update({
        id: queueGroup.id,
      }, {
        completed: true,
      }).toPromise();
    }));

    // Create a new Up Next batch
    promises.push(
      Batch.create({ queue: queue.id }).then(newBatch => {
        // Move batches into new positions
        return Queue.update({
          id: queue.id,
        }, {
          currentBatch: queue.nextBatch,
          nextBatch: newBatch.id,
        }).toPromise();
      })
    );
  
    await Promise.all(promises);
    return currentBatch.groups.map(queueGroup => queueGroup.id);
  }
};

