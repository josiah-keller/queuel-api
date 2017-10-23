const _ = require("lodash");
const POSITION_INCREMENT = 100;

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
  }
};

