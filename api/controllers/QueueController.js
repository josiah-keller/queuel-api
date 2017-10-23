const _ = require("lodash");

module.exports = {
	getQueues: (req, res) => {
    Queue.find().populate("groups")
    .then(queues => {
      if (req.isSocket) {
        Queue.subscribe(req, _.map(queues, "id"));
        Queue.watch(req);
      }
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
      queue.groups = [];
      Queue.publishCreate(queue);
      return res.json(queue);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
  deleteQueue: (req, res) => {
    let id = req.param("id");
    Queue.destroy({ id })
    .then(queues => {
      Queue.publishDestroy(id);
      return res.json(queues);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  },
};
