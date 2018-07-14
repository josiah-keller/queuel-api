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

      if (queueGroup.pending || queueGroup.completed) {
        return res.badRequest("Can't batch a pending or completed QueueGroup");
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
  autoPopulateBatch: async (req, res) => {
    try {
      let id = req.param("id");
      
      let batch = await Batch.findOne({ id }).populate("queue");
      let targetBatchSize = batch.queue.targetBatchSize;

      let currentQueueGroups = await QueueGroup.find({ batch: id }).populate("group");
      let currentSize = currentQueueGroups.reduce((size, queueGroup) => {
        return size + queueGroup.group.groupSize;
      }, 0);

      let queueGroupsPool = await QueueGroup.find({
        queue: batch.queue.id,
        completed: false,
        pending: false,
      }).populate("group").sort("position ASC");

      let groupsToAdd = [];

      for (let i=0; i<queueGroupsPool.length; i++) {
        if (currentSize >= targetBatchSize) break;

        if (!! queueGroupsPool[i].batch) continue;
        if (currentSize + queueGroupsPool[i].group.groupSize > targetBatchSize) continue;

        currentSize += queueGroupsPool[i].group.groupSize;
        groupsToAdd.push(queueGroupsPool[i]);
      }

      await Promise.all(groupsToAdd.map(queueGroup => {
        return Batch.addQueueGroupToBatch(id, queueGroup.id).then(updatedQueueGroup => {
          QueueGroup.publishUpdate(updatedQueueGroup.id, {
            id: updatedQueueGroup.id,
            queue: updatedQueueGroup.queue,
            batch: id,
          });
          updatedQueueGroup.group = queueGroup.group;
          Batch.publishAdd(id, "groups", updatedQueueGroup, null, { noReverse: true });
        });
      }));

      return res.json(groupsToAdd);
    } catch(err) {
      return res.negotiate(err);
    }
  },
};