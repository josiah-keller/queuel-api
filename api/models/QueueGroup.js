module.exports = {

  attributes: {
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

