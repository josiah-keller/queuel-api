const _ = require("lodash");
const Twilio = require("twilio");
const twilioCredentials = require("./twilio-credentials");

let haveAllCredentials = twilioCredentials.sid && twilioCredentials.authToken && twilioCredentials.phoneNumber;

let client = haveAllCredentials ? new Twilio(twilioCredentials.sid, twilioCredentials.authToken) : null;

if (! haveAllCredentials) {
  sails.log.warn("Missing Twilio credentials - no texts will be sent");
}

module.exports = {
  messages: {
    nextGroup: (vars) => {
      return `${vars.groupName}, you're next in the ${vars.queueName} queue! Please make your way to the entrance.`;
    },
    welcome: (vars) => {
      return `${vars.groupName}, you have subscribed to be notified when it's your turn for the events you signed up for.`;
    },
    disclaimer: (vars) => {
      return `Standard messaging rates apply. Reply CANCEL to cancel *all* events you signed up for. Reply STOP to unsubscribe.`;
    },
    notMonitored: (vars) => {
      return `This number is not monitored. Please see the kiosk for any questions. Reply CANCEL to cancel *all* events you signed up for.`;
    },
    canceled: (vars) => {
      return `Sorry to see you go, ${vars.groupName}. You've been removed from all queues.`;
    },
  },
  sendText: function(messageTemplateName, messageVars, phoneNumber) {
    if (! _.isFunction(TextService.messages[messageTemplateName])) {
      throw new Error("Invalid message template name");
    }
    if (! phoneNumber) {
      console.log("No phone number; not sending text");
      return Promise.resolve();
    }
    let message = TextService.messages[messageTemplateName](messageVars);
    console.log(`Sending message to ${phoneNumber}:\n${message}`);

    if (! client) {
      return Promise.resolve(message);
    } else {
      return new Promise((resolve, reject) => {
        client.messages.create({
          to: phoneNumber,
          from: twilioCredentials.phoneNumber,
          body: message,
        })
        .then(message => {
          return resolve(message);
        })
        .catch(err => {
          console.log(`Couldn't send message to ${phoneNumber}, error follows`, err);
          return reject(err);
        });
      });
    }
  },
  welcome: async (groupName, phoneNumber) => {
    await TextService.sendText("welcome", { groupName }, phoneNumber);
    await TextService.sendText("disclaimer", {}, phoneNumber);
  },
  matchKeyword: (keyword, message) => {
    return message.toString().trim().toUpperCase() === keyword;
  },
};