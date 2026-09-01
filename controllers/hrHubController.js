/*************************************************************
 * hrHubController.js — port of HR.html/HR.js.html's tab shell.
 * There's no HR.gs backend in the original at all — HR.html is
 * purely a client-side set of tab buttons that show/hide sections
 * of one page, each section calling the SAME engines (LeaveEngine,
 * PMSEngine, etc.) already ported as their own real pages elsewhere
 * in this app. So there's no business logic to port here, just a
 * landing page tiling links to every HR module — this app's
 * equivalent of "the tab bar", since real server-rendered pages
 * replace client-side tab-switching throughout this migration.
 *
 * Tile visibility mirrors header.ejs's nav gating exactly (HR-team /
 * IT-team / Admin-team / Manager-or-Admin), computed here instead of
 * inline in the view so the same boolean logic isn't duplicated a
 * third time.
 *************************************************************/
const { isHRTeam, isITTeam, isAdminTeam } = require("../utils/teamAccess");
const { ROLE } = require("../config/constants");

function showHub(req, res) {
  const isManagerOrAdmin = req.user.role === ROLE.ADMIN || req.user.role === ROLE.MANAGER;

  res.render("hr/index", {
    isHR: isHRTeam(req.user),
    isIT: isITTeam(req.user),
    isAdminTeam: isAdminTeam(req.user),
    isManagerOrAdmin,
  });
}

module.exports = { showHub };
