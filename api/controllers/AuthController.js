module.exports = {
  authenticate: (req, res) => {
    if (req.param("password") === process.env.CLIENT_PASSWORD) {
      req.session.authenticated = true;
      return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
  },
  checkAuth: (req, res) => {
    return res.json({ authenticated: !! req.session.authenticated });
  }
}