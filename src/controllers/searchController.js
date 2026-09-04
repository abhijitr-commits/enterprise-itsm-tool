const { globalSearch } = require("../utils/globalSearch");

async function showResults(req, res) {
  const q = req.query.q || "";
  const tooShort = q.trim().length > 0 && q.trim().length < 2;
  const results = await globalSearch(q);

  res.render("search/results", { q, results, tooShort });
}

module.exports = { showResults };
