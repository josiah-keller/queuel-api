module.exports = {
  attributes: {
    queue: {
      model: "queue",
    },
    groups: {
      collection: "QueueGroup",
      via: "batch",
    },
  },

  addQueueGroupToBatch: async function(batchId, queueGroupId) {
    return (await QueueGroup.update({ id: queueGroupId, }, { batch: batchId, }))[0];
  },

  removeQueueGroupFromBatch: async function(batchId, queueGroupId) {
    return (await QueueGroup.update({ id: queueGroupId, }, { batch: null, }))[0];
  },
};