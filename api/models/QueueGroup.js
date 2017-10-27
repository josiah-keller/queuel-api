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
    group: {
      model: "group",
    },
    next: {
      model: "queuegroup",
    },
  },
};

