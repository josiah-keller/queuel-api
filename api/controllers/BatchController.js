const _ = require("lodash");

module.exports = {
  getBatchesByQueue: async (req, res) => {
    try {
      let batches = await Batch.find({
        queue: req.param("queueId")
      }).populate("groups");
      
      if (req.isSocket) {
        Batch.subscribe(req, _.map(batches, "id"));
        Batch.watch(req);
      }

      return res.json(batches);
    } catch(err) {
      return res.negotiate(err);
    }
  },
  newBatchForQueue: async (req, res) => {
    try {
      let queueId = req.param("queueId");
      let queue = await Queue.findOne(queueId).populate("nextBatch");
      let batch = await Batch.create({
        queue: queueId,
      });
      let newQueue = {
        currentBatch: queue.nextBatch.id,
        nextBatch: batch.id,
      };
      await Queue.update({ id: queueId }, newQueue);
      Batch.publishCreate(batch);
      Queue.publishUpdate(queueId, {
        currentBatch: queue.nextBatch,
        nextBatch: batch,
      });
      return res.json(batch);
    } catch(err) {
      return res.negotiate(err);
    }
  },
  getQueueGroupsForBatch: async (req, res) => {
    try {
      let id = req.param("id");
      let groups = await QueueGroup.find({
        batch: id,
      }).populate("group");
      QueueGroup.subscribe(req, _.map(groups, "id"));
      Group.subscribe(req, _.map(groups, group => group.group.id));
      Batch.subscribe(req, [id]);
      return res.json(groups);
    } catch(err) {
      return res.negotiate(err);
    }
  },
  addQueueGroupToBatch: async (req, res) => {
    try {
      let batchId = req.param("batchId"), queueGroupId = req.param("queueGroupId");
      let batch = await Batch.findOne({ id: batchId }),
        queueGroup = await QueueGroup.findOne({ id: queueGroupId });

      if (! batch || ! queueGroup) {
        return res.notFound();
      }

      if (batch.queue !== queueGroup.queue) {
        return res.badRequest("Batch and QueueGroup must belong to same queue");
      }

      let updatedQueueGroup = await Batch.addQueueGroupToBatch(batchId, queueGroupId);
      updatedQueueGroup.group = await Group.findOne({ id: updatedQueueGroup.group });
      QueueGroup.publishUpdate(updatedQueueGroup.id, {
        id: updatedQueueGroup.id,
        queue: updatedQueueGroup.queue,
        batch: batchId,
      });
      Batch.publishAdd(batchId, "groups", updatedQueueGroup, null, { noReverse: true });

      return res.json(updatedQueueGroup);
    } catch(err) {
      return res.negotiate(err);
    }
  },
  removeQueueGroupFromBatch: async (req, res) => {
    try {
      let batchId = req.param("batchId"), queueGroupId = req.param("queueGroupId");
      let batch = await Batch.findOne({ id: batchId }),
        queueGroup = await QueueGroup.findOne({ id: queueGroupId });
      
      if (! batch || ! queueGroup) {
        return res.notFound();
      }

      if (queueGroup.batch != batchId) {
        return res.notFound();
      }

      let updatedQueueGroup = await Batch.removeQueueGroupFromBatch(batchId, queueGroupId);
      updatedQueueGroup.group = await Group.findOne({ id: updatedQueueGroup.group });

      QueueGroup.publishUpdate(updatedQueueGroup.id, {
        id: updatedQueueGroup.id,
        queue: updatedQueueGroup.queue,
        batch: null,
      });
      Batch.publishRemove(batchId, "groups", updatedQueueGroup.id, null, { noReverse: true });

      return res.json(updatedQueueGroup);
    } catch(err) {
      return res.negotiate(err);
    }
  },
};