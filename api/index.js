const path = require('path');
process.env.VERCEL = '1';
// Load .env for Vercel local dev
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('../server/index.js');
module.exports = app;
