const express = require("express");
const router = express.Router();
const benefitsController = require("../controllers/benefitsController");
const { requireLogin } = require("../middleware/auth");
const { requireHRTeam } = require("../utils/teamAccess");

router.use(requireLogin);
// Every route here is HR-team-only — matches the original's
// requireHRTeam() calls throughout BenefitsEngine.gs exactly. Self-service
// viewing is through My Profile's "My Benefits" section instead.
router.use(requireHRTeam);

router.get("/", benefitsController.listBenefits);
router.get("/new", benefitsController.showNewForm);
router.post("/", benefitsController.createEnrollment);
router.post("/:id/status", benefitsController.updateStatus);

module.exports = router;
