const path = require('path');
process.env.VERCEL = '1';
// On Vercel, env vars are set via dashboard — dotenv not needed
let app;
try {
  app = require('../server/index.js');
} catch (err) {
  // Fallback: return the error as a response so we can debug
  app = (req, res) => {
    res.status(500).json({ error: 'Server failed to load', message: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  };
}
module.exports = app;
