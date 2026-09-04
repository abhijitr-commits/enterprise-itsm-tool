/*************************************************************
 * itHubController.js — port of ITManagement.html/.js.html's tab
 * shell, the same treatment Phase 4F gave HR.html/.js.html
 * (hrHubController.js): there's no real backend logic in the
 * original beyond tab-switching, so this is a landing page tiling
 * links to every IT Operations module, grouped exactly the way the
 * original's own tab bar grouped them (Support / Employee Lifecycle
 * / Assets & Licensing / Vendors & Procurement / Operations /
 * System Access) — see ITManagement.html.
 *
 * Deliberately NOT included: Room Booking, Complaints, Expense
 * Claims, Stock/Inventory, Purchase Register — none of these were
 * part of ITManagement.js.html's own tab groups in the original (its
 * tab bar only ever covered Support/Employee Lifecycle/Assets &
 * Licensing/Vendors & Procurement/Operations/System Access); they
 * stay sidebar-only, same as they've been since Phase 5B-5D, so this
 * hub stays a faithful port rather than growing scope the original
 * page never had.
 *
 * Also not included: "Site Monitoring" (goToAdminSection('monitoring')
 * in the original) — MonitoringEngine.gs is one of the engines this
 * migration has deliberately deferred (see MIGRATION.md); there is
 * no page for this tile to link to yet.
 *
 * Tile visibility mirrors header.ejs's nav gating: everyone signed
 * in sees the page (same as the HR Hub), IT-team members see the
 * IT-only tiles, and the "System Access" group (User Management /
 * Permission Matrix) only appears for a true Administrator — those
 * two routes are Administrator-only in the Permission Matrix
 * regardless (admin_manage_users/admin_manage_settings), so an IT
 * Manager who isn't also an Administrator couldn't open them anyway.
 *************************************************************/
const { isITTeam, isAdminTeam } = require("../utils/teamAccess");
const { ROLE } = require("../config/constants");

function showHub(req, res) {
  res.render("it/index", {
    isIT: isITTeam(req.user),
    isAdminTeam: isAdminTeam(req.user),
    isAdministrator: req.user.role === ROLE.ADMIN,
  });
}

module.exports = { showHub };
