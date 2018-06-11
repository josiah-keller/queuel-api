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
};