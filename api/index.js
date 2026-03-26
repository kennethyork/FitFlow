let app;
try {
  const path = require('path');
  process.env.VERCEL = '1';
  app = require('../server/index.js');
} catch (err) {
  const express = require('express');
  app = express();
  const msg = { error: 'Server failed to load', message: err.message, stack: err.stack?.split('\n').slice(0, 5) };
  app.all('*', (req, res) => res.status(500).json(msg));
}
module.exports = app;
