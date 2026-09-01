const express = require("express");
const router = express.Router();
const resignationController = require("../controllers/resignationController");
const { requireLogin } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");
const { requireHRTeam } = require("../utils/teamAccess");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", resignationController.listResignations);
router.get("/new", guard("resignation_submit"), resignationController.showNewForm);
router.post("/", guard("resignation_submit"), resignationController.createResignation);
router.get("/:id", resignationController.showResignation);
router.post("/:id/clearance", requireHRTeam, resignationController.updateClearance);
router.get("/:id/exit-interview", requireHRTeam, resignationController.showExitInterviewForm);
router.post("/:id/exit-interview", requireHRTeam, resignationController.submitExitInterview);

module.exports = router;
