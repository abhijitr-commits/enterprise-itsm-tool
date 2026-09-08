/*************************************************************
 * portalController.js — the Service Portal (Architecture Phase 2
 * — see itsm_architecture_comparison.md): one search-first
 * "storefront" landing page combining the Request Catalog and the
 * Knowledge Base, so an employee can try to self-solve (read a KB
 * article) before filing a ticket at all — the same "deflection"
 * idea behind ServiceNow's Employee Center, BMC's Digital
 * Workplace, and Freshservice's self-service portal.
 *
 * Deliberately open to every signed-in user (same tier as the
 * Dashboard) rather than gated by an ITSM-specific permission —
 * self-service is for every employee, not just IT/service desk
 * staff. It only ever reads Published KB articles and active
 * catalog entries, and every result links out to a page that
 * enforces its own existing permission checks (requests/new,
 * knowledge/:id) — this page grants no new access on its own.
 *************************************************************/
const RequestCatalog = require("../models/RequestCatalog");
const KnowledgeArticle = require("../models/KnowledgeArticle");

async function showPortal(req, res) {
  const q = (req.query.q || "").trim();

  let kbResults = [];
  let catalogResults = [];

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    [kbResults, catalogResults] = await Promise.all([
      KnowledgeArticle.find({
        status: "Published",
        $or: [{ title: rx }, { content: rx }, { category: rx }],
      })
        .select("articleId title category")
        .sort({ lastUpdated: -1 })
        .limit(10)
        .lean(),
      RequestCatalog.find({
        active: true,
        $or: [{ name: rx }, { category: rx }, { description: rx }],
      })
        .select("name category description")
        .sort({ requestCount: -1 })
        .limit(10)
        .lean(),
    ]);
  }

  const [popularCatalogItems, recentArticles] = await Promise.all([
    RequestCatalog.find({ active: true }).sort({ requestCount: -1, name: 1 }).limit(8).select("name category requestCount").lean(),
    KnowledgeArticle.find({ status: "Published" }).sort({ lastUpdated: -1 }).limit(6).select("articleId title category").lean(),
  ]);

  res.render("portal/index", {
    q,
    searched: !!q,
    kbResults,
    catalogResults,
    popularCatalogItems,
    recentArticles,
  });
}

module.exports = { showPortal };
