/*************************************************************
 * moduleVisibility.js — port of the "moduleVisibility" block in
 * the original Navigation.gs's doGet(). Hides a sidebar link
 * entirely when the signed-in user's role has been given ZERO
 * permissions for that module in the Permission Matrix (e.g. a
 * Viewer whose "knowledge_*" actions were all unticked in
 * /admin/permissions won't see "Knowledge Base" in the sidebar
 * at all, rather than seeing a dead link that 403s).
 *
 * Route-level guard() middleware is still the real enforcement —
 * this only controls what the sidebar shows, same division of
 * responsibility as the original (moduleVisibility decided what
 * to render; requirePermission() on the server enforced it).
 *************************************************************/
const { hasPermission } = require("../utils/permissions");

const MODULE_ACTIONS = {
  incidents: ["incidents_create", "incidents_edit", "incidents_close"],
  requests: ["requests_create", "requests_edit", "requests_approve"],
  problems: ["problems_create", "problems_edit"],
  changes: ["changes_create", "changes_edit", "changes_approve"],
  assets: ["assets_create", "assets_edit", "assets_issue"],
  cmdb: ["cmdb_create", "cmdb_edit"],
  knowledge: ["knowledge_create", "knowledge_edit"],
  reports: ["reports_view"],
};

async function attachModuleVisibility(req, res, next) {
  try {
    if (!req.user) return next();

    const role = req.user.role;
    const visibility = {};

    for (const [moduleKey, actions] of Object.entries(MODULE_ACTIONS)) {
      let visible = false;
      for (const action of actions) {
        // eslint-disable-next-line no-await-in-loop
        if (await hasPermission(role, action)) {
          visible = true;
          break;
        }
      }
      visibility[moduleKey] = visible;
    }

    res.locals.moduleVisibility = visibility;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachModuleVisibility };
