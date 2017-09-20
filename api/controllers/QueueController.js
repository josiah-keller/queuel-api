module.exports = {
	getQueues: (req, res) => {
    Queue.find()
    .then(queues => {
      return res.json(queues);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  addQueue: (req, res) => {
    if (! req.param("name")) {
      return res.badRequest();
    }
    let newQueue = {
      name: req.param("name"),
    };
    Queue.create(newQueue)
    .then(queue => {
      return res.json(queue);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  }
};

