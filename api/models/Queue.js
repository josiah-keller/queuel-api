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

  nextPositionIndex: (queue, pending) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    if (! queueId) return Promise.reject(new Error("No queue specifeid"));
    
    pending = !! pending;

    return new Promise((resolve, reject) => {
      QueueGroup.find({
        queue: queueId,
      })
      .sort("position DESC")
      .then(queueGroups => {
        if (! queueGroups || queueGroups.length === 0) {
          return resolve(POSITION_INCREMENT);
        }
        QueueGroup.count({
          queue: queueId,
          completed: false,
        })
        .then(concreteLength => {
          let index = 0;
          while (queueGroups[index].pending) index++;
  
          // Send to back if:
          //  - No placeholders in the way (index === 0)
          //  - The new group is pending
          //  - The "concrete length" (ie, groups actually still in line, not completed) is big enough that
          //    there are no placeholders up at the top
          if (index === 0 || pending || concreteLength >= 3) {
            resolve(queueGroups[0].position + POSITION_INCREMENT);
          } else {
            // Handle case where queue is very sparse and placeholders have made it to the very top
            // by pushing the placeholders down
            resolve(
              ((queueGroups[index - 1].position - queueGroups[index].position) / 2) + queueGroups[index].position
            );
          }
        })
        .catch(reject);
      })
      .catch(reject);
    });
  },

  incrementQueue: (queue, direction) => {
    let queueId = _.isString(queue) ? queue : queue.id;
    return new Promise((resolve, reject) => {
      QueueGroup.find({
        queue: queueId,
        completed: (direction !== 1), // Want top uncompleted if advancing, bottom completed if reversing
      })
      .sort(direction === 1 ? "position ASC" : "position DESC")
      .then(queueGroups => {
        if (queueGroups.length === 0) {
          return resolve([]);
        }
        async.auto({
          "leapfrog": (callback) => {
            if (direction === -1) {
              // No leapfrogging if going backwards
              return callback(null, null);
            }
            QueueGroup.count({
              queue: queueId,
              completed: true
            })
            .then(completedOffset => {
              // 0 is current, 1 is next, 2 is what we want to leapfrog over
              // Must offset actual index to account for completed groups off the top of the queue
              let index = 2 + completedOffset;
              if (queueGroups.length >= 4 && queueGroups[2].pending) {
                // At least 4 groups (current, next, next-to-next + at least one more)
                // AND next-to-next is a placeholder, so we want to leapfrog it
                Queue.calculateNewPosition(queueId, index, index + 1)
                .then(newPosition => {
                  QueueGroup.update({
                    id: queueGroups[2].id,
                  }, {
                    position: newPosition,
                  })
                  .then(updatedQueueGroups => {
                    QueueGroup.publishUpdate(updatedQueueGroups[0].id, {
                      id: updatedQueueGroups[0].id,
                      queue: updatedQueueGroups[0].queue,
                      position: updatedQueueGroups[0].position,
                    });
                    callback(null, updatedQueueGroups);
                  })
                  .catch(err => {
                    return callback(err);
                  });
                })
                .catch(err => {
                  return callback(err);
                });
              } else {
                // Else, no leapfrogging
                return callback(null, null);
              }
            })
            .catch(err => {
              return callback(err);
            })
          },
          "advance": [
            "leapfrog", (data, callback) => {
              QueueGroup.update({
                id: queueGroups[0].id
              }, {
                completed: (direction === 1) // Mark completed=true if advancing, unmark if reversing
              })
              .then(updatedQueueGroups => {
                return callback(null, updatedQueueGroups);
              })
              .catch(err => {
                return callback(err);
              });
          }],
        }, (err, results) => {
          if (err) {
            return reject(err);
          }
          return resolve(results.advance);
        });
      })
      .catch(reject);
    });
  }
};

