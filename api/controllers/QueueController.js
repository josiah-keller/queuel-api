module.exports = {
	getQueues: (req, res) => {
    Queue.find()
    .then(queues => {
      return res.json(queues);
    })
    .catch(err => {
      return res.negotiate(err);
    });
  }
};

