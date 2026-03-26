const path = require('path');
process.env.VERCEL = '1';
// On Vercel, env vars are set via dashboard — dotenv not needed
const app = require('../server/index.js');
module.exports = app;
