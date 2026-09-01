const express = require("express");
const router = express.Router();
const requirementController = require("../controllers/requirementController");
const { requireLogin } = require("../middleware/auth");
const { isITTeam, isAdminTeam } = require("../utils/teamAccess");

/** Port of the original's inline "!isITTeam() && !isAdminTeam()" check — usable by IT team OR Admin team (both handle vendor-facing procurement-style needs). */
function requireITOrAdminTeam(req, res, next) {
  if (isITTeam(req.user) || isAdminTeam(req.user)) return next();
  return res.status(403).render("errors/403", { action: "IT team or Admin team only" });
}

router.use(requireLogin);
router.use(requireITOrAdminTeam);

router.get("/", requirementController.listRequirements);
router.post("/", requirementController.submitRequirement);
router.post("/:id/status", requirementController.updateStatus);

module.exports = router;
