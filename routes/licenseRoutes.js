const express = require("express");
const router = express.Router();
const softwareLicenseController = require("../controllers/softwareLicenseController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Same open-read/Admin-team-gated-write split as Stock — matches the
// original's getAllLicensesSafe() having no permission check while
// createLicense()/updateLicense() both call requireAdminTeam().
router.get("/", softwareLicenseController.listLicenses);
router.get("/new", requireAdminTeam, softwareLicenseController.showNewForm);
router.post("/", requireAdminTeam, softwareLicenseController.createLicense);
router.get("/:id/edit", requireAdminTeam, softwareLicenseController.showEditForm);
router.post("/:id", requireAdminTeam, softwareLicenseController.updateLicense);

module.exports = router;
