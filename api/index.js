const path = require('path');
process.env.VERCEL = '1';
const app = require('../server/index.js');
module.exports = app;
