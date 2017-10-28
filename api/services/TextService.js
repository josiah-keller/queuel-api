const _ = require("lodash");

module.exports = {
  messages: {
    currentGroup: (vars) => {
      return `${vars.groupName}, you're next in the ${vars.queueName} queue! Please make your way to the entrance.`
    },
  },
  sendText: function(messageTemplateName, messageVars, phoneNumber) {
    if (! _.isFunction(TextService.messages[messageTemplateName])) {
      throw new Error("Invalid message template name");
    }
    let message = TextService.messages[messageTemplateName](messageVars);
    console.log(`Sending message to ${phoneNumber}:\n${message}`);
    return Promise.resolve();
  }
};