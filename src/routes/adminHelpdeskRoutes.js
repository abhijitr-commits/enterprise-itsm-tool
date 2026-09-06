const express = require("express");
const router = express.Router();
const adminHelpdeskController = require("../controllers/adminHelpdeskController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Same open-submit / Admin-team-manage split as complaintRoutes.js's
// generic Complaints module — any signed-in employee can raise a
// facility request; only the Admin team triages/resolves it.
router.get("/", adminHelpdeskController.listComplaints);
router.get("/new", adminHelpdeskController.showNewForm);
router.post("/", adminHelpdeskController.submitComplaint);
router.post("/:complaintId/status", requireAdminTeam, adminHelpdeskController.updateStatus);

module.exports = router;
