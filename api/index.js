import { createRequire } from 'module';
const require = createRequire(import.meta.url);
process.env.VERCEL = '1';
const app = require('../server/index.js');
export default app;
