const _ = require("lodash");
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
    groups:  {
      collection: "QueueGroup",
      via: "queue",
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

  nextPositionIndex: (queue) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    if (! queueId) return Promise.reject(new Error("No queue specifeid"));

    return new Promise((resolve, reject) => {
      QueueGroup.find({
        queue: queueId,
      })
      .sort("position DESC")
      .then(queueGroups => {
        if (! queueGroups || queueGroups.length === 0) {
          return resolve(POSITION_INCREMENT);
        }
        resolve(queueGroups[0].position + POSITION_INCREMENT);
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  incrementQueue: (queue, direction) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    return new Promise((resolve, reject) => {
      // Want top uncompleted if advancing, bottom completed if reversing
      QueueGroup.find({ queue: queueId, completed: (direction !== 1) })
      .sort(direction === 1 ? "position ASC" : "position DESC")
      .then(queueGroups => {
        if (queueGroups.length === 0) {
          return resolve([]);
        }
        QueueGroup.update({
          id: queueGroups[0].id
        }, {
          completed: (direction === 1) // Mark completed=true if advancing, unmark if reversing
        })
        .then(updatedQueueGroups => {
          return resolve(updatedQueueGroups);
        })
        .catch(reject);
      })
      .catch(reject);
    });
  }
};

