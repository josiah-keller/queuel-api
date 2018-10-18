module.exports = {
  subscribeAlerts: async (req, res) => {
    try {
      if (req.isSocket) {
        Alert.watch(req);
      }

      return res.ok();
    } catch (err) {
      return res.negotiate(err);
    }
  },
};