const _ = require("lodash");

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
    cantText: {
      type: "boolean",
      defaultsTo: false,
    },
  },

  beforeCreate: (newValues, cb) => {
    return formatPhoneNumber(newValues, cb);
  },
  beforeUpdate: (newValues, cb) => {
    return formatPhoneNumber(newValues, cb);
  },
  
  updateCantText: async (cantText, phoneNumber) => {
    let group = await Group.findOne({ phoneNumber: phoneNumber });
    if (! group) throw new Error("No group by that phone number");
    await Group.update({ id: group.id }, { cantText });
    Group.publishUpdate(group.id, {
      id: group.id,
      cantText: cantText,
    });
  },

  deleteGroup: async (id) => {
    let group = await Group.findOne(id);
    if (! group) {
      throw { status: 404, message: "Not Found" };
    }

    let groups = await Group.destroy({ id });
    Group.publishDestroy(id);

    let queueGroups = await QueueGroup.destroy({ group: id })
    queueGroups.forEach(queueGroup => {
      QueueGroup.publishDestroy(queueGroup.id);
      Queue.publishRemove(queueGroup.queue, "groups", queueGroup.id);
    });
    return groups;
  },

  cancelReservations: async(phoneNumber) => {
    let group = await Group.findOne({ phoneNumber });
    if (! group) {
      throw { status: 404, message: "Not Found" };
    }
    await Group.deleteGroup(group.id);
    return group;
  },
};

function formatPhoneNumber(newValues, cb) {
  // Force phone numbers to have +1 prefix
  // Obviously makes phone numbers US-only
  if (! newValues.phoneNumber) {
    return cb(null);
  }
  if (newValues.phoneNumber.startsWith("1")) {
    newValues.phoneNumber = "+" + newValues.phoneNumber;
  } else if (! newValues.phoneNumber.startsWith("+")) {
    newValues.phoneNumber = "+1" + newValues.phoneNumber;
  }
  newValues.phoneNumber = newValues.phoneNumber.replace(new RegExp("-", "g"), "");
  return cb(null);
}