// pages/api/ping.js

export default (req, res) => {
  res.status(200).json({ msg: 'Hello Ping' });
};
