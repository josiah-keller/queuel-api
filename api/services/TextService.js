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
          to: "1" + phoneNumber.replace(new RegExp("-", "g"), ""),
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
  }
};