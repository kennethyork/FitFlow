module.exports = (req, res) => {
  const fs = require('fs');
  const serverModules = fs.existsSync('/var/task/server/node_modules');
  const rootModules = fs.existsSync('/var/task/node_modules');
  const files = fs.readdirSync('/var/task/api');
  const serverFiles = fs.existsSync('/var/task/server') ? fs.readdirSync('/var/task/server').slice(0, 20) : [];
  res.json({ serverModules, rootModules, apiFiles: files, serverFiles });
};
