const _ = require("lodash");

module.exports = {

  attributes: {
    completed: {
      type: "boolean",
      defaultsTo: false,
    },
    pending: {
      type: "boolean",
      defaultsTo: false,
    },
    position: {
      type: "float",
      required: true,
    },
    queue: {
      model: "queue",
    },
    batch: {
      model: "batch",
    },
    group: {
      model: "group",
    },
    next: {
      model: "queuegroup",
    },
    messaged: {
      type: "boolean",
      defaultsTo: false,
    },
  },

  resolvePlaceholder: (queueGroup) => {
    let queueGroupId = _.isString(queueGroup) ? queueGroup : queueGroup.id;
    return new Promise((resolve, reject) => {
      QueueGroup.findOne(queueGroupId)
      .then(queueGroup => {
        if (! queueGroup || ! queueGroup.next) {
          return resolve(null);
        }
        QueueGroup.findOne(queueGroup.next)
        .then(nextQueueGroup => {
          if (! nextQueueGroup) {
            return resolve(null);
          }
          QueueGroup.update({
            id: nextQueueGroup.id,
          }, {
            pending: false,
          })
          .then(updatedQueueGroups => {
            return resolve(updatedQueueGroups[0]);
          })
          .catch(reject);
        })
        .catch(reject);
      })
      .catch(reject);
    });
  }
};