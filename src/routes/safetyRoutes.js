const express = require("express");
const router = express.Router();
const safetyController = require("../controllers/safetyController");
const { requireLogin } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", guard("safety_manage"), safetyController.listSafetyIncidents);
router.get("/mine", safetyController.mySafetyIncidents);
router.get("/new", guard("safety_submit"), safetyController.showNewForm);
router.post("/", guard("safety_submit"), safetyController.submitSafetyIncident);
router.post("/:id/status", guard("safety_manage"), safetyController.updateStatus);

module.exports = router;
