const _ = require("lodash");

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
};

