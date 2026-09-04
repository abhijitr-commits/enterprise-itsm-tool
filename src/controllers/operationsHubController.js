/*************************************************************
 * operationsHubController.js — a front-screen landing page for
 * every module that sits outside the HR Hub (/hr) and IT
 * Management Hub (/it): Sales, Production & Logistics; Safety;
 * Facilities & Procurement; Expenses & Complaints; and Wellness &
 * Engagement. Same pattern as hrHubController.js/itHubController.js
 * — no real backend logic, just a role-aware tile grid so every
 * department's modules are one click from a single landing page
 * instead of sidebar-only links.
 *
 * Tile visibility mirrors header.ejs's nav gating exactly: the
 * "All ..." / management tiles only show for Administrator or
 * Manager, same rule the sidebar itself already uses for Safety,
 * Complaints, and Expense Claims. The real permission check still
 * lives on each route/controller — this only controls what's
 * offered on the tile grid.
 *************************************************************/
const { ROLE } = require("../config/constants");

function showHub(req, res) {
  const user = req.user;
  const isManagerUp = user.role === ROLE.ADMIN || user.role === ROLE.MANAGER;
  res.render("operations/index", {
    isManagerUp,
    isAdministrator: user.role === ROLE.ADMIN,
  });
}

module.exports = { showHub };
