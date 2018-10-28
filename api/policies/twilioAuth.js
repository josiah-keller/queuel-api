const twilioCredentials = require("../services/twilio-credentials");

module.exports = function(req, res, next) {
  if (req.param("AccountSid") === twilioCredentials.sid) {
    return next();
  }

  return res.forbidden("This endpoint is intended only for Twilio.");
};