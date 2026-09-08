const express = require("express");
const router = express.Router();
const automationController = require("../controllers/automationController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

// Mirrors requirePermission() from Security.gs — same pattern used by every
// other module's routes file (see incidentRoutes.js / adminRoutes.js).
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
router.use(guard("automation_manage"));

router.get("/", automationController.listRules);
router.get("/new", automationController.showNewForm);
router.post("/", automationController.createRule);
router.get("/:id/edit", automationController.showEditForm);
router.post("/:id", automationController.updateRule);
router.post("/:id/toggle", automationController.toggleRule);
router.post("/:id/delete", automationController.deleteRule);

module.exports = router;
