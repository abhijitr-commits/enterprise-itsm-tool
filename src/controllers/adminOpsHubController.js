/*************************************************************
 * adminOpsHubController.js — front-screen landing page for the
 * Admin team's operational registers: Vendor Management, Stock
 * Management/Orders, Scrap Management, Asset Register, Purchases,
 * Facility Helpdesk, Facility Ops Tasks, Admin Onboarding/
 * Offboarding, and Room Bookings. Same pattern as
 * hrHubController.js/itHubController.js/operationsHubController.js
 * — no real backend logic, just a tile grid. Reachable at
 * /admin/ops, gated by requireAdminTeam (see adminOpsHubRoutes.js)
 * — the exact same gate every one of these operational routes
 * already enforces individually, so this page grants no new
 * access; see the comment above its app.use() in server.js for
 * why it's a separate route from "/admin" itself rather than an
 * expansion of that page's Administrator-only gate.
 *************************************************************/
const { ROLE } = require("../config/constants");

function showHub(req, res) {
  res.render("admin/ops", {
    isAdministrator: req.user.role === ROLE.ADMIN,
  });
}

module.exports = { showHub };
