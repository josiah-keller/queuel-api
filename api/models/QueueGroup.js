module.exports = {

  attributes: {
    pending: {
      type: "boolean",
      defaultsTo: false,
    },
    position: {
      type: "integer",
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

