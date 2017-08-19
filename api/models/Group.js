module.exports = {

  attributes: {
    queues: {
      collection: "queuegroup",
      via: "group",
    },
    name: {
      type: "string",
    },
    phoneNumber: {
      type: "string",
    },
    groupSize: {
      type: "integer",
    },
  },
};

