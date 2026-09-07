/*************************************************************
 * itsmHubController.js — front-screen landing page for the core
 * ITSM ticketing suite (Incidents, Service Requests, Problems,
 * Changes, Assets, CMDB, Knowledge Base, Reports). Same pattern
 * as hrHubController.js/itHubController.js/operationsHubController.js
 * — no real backend logic, just a role-aware tile grid so these
 * modules are one click from the Dashboard instead of needing a
 * dedicated top-nav dropdown.
 *
 * Tile visibility mirrors what the old ITSM nav dropdown used to
 * gate with: moduleVisibility (res.locals.moduleVisibility, set
 * globally by src/middleware/moduleVisibility.js) hides a tile
 * entirely once a role has zero permissions left for that module,
 * and Executive Summary stays Manager/Administrator only. The real
 * permission check still lives on each module's own routes — this
 * only controls what's offered on the tile grid.
 *************************************************************/
const { ROLE } = require("../config/constants");

function showHub(req, res) {
  const user = req.user;
  res.render("itsm/index", {
    isManagerUp: user.role === ROLE.ADMIN || user.role === ROLE.MANAGER,
  });
}

module.exports = { showHub };
