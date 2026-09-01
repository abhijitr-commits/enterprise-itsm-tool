const express = require("express");
const router = express.Router();
const incidentController = require("../controllers/incidentController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

// Mirrors requirePermission() from Security.gs (throw -> here, a 403 render),
// checked against the same action -> allowed-roles map (config/permissions.js).
function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) {
      return res.status(403).render("errors/403", { action });
    }
    next();
  };
}

router.use(requireLogin);

router.get("/", incidentController.listIncidents);
router.get("/new", guard("incidents_create"), incidentController.showNewForm);
router.post("/", guard("incidents_create"), incidentController.createIncident);
router.get("/:id", incidentController.showIncident);
router.post("/:id", guard("incidents_edit"), incidentController.updateIncident);
router.post("/:id/close", guard("incidents_close"), incidentController.closeIncident);
router.post("/:id/delete", guard("incidents_delete"), incidentController.deleteIncident);
router.post("/bulk-close", guard("incidents_close"), incidentController.bulkCloseIncidents);
router.post("/:id/comments", incidentController.addComment);

module.exports = router;
