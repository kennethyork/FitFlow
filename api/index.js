// Phase 1: minimal test — does the function even boot?
module.exports = (req, res) => {
  res.json({ ok: true, test: 'minimal function works' });
};
