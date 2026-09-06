const express = require("express");
const router = express.Router();
const adminFacilityTaskController = require("../controllers/adminFacilityTaskController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

router.get("/", adminFacilityTaskController.listTasks);
router.get("/new", requireAdminTeam, adminFacilityTaskController.showNewForm);
router.post("/", requireAdminTeam, adminFacilityTaskController.createTask);
router.post("/:taskId/complete", requireAdminTeam, adminFacilityTaskController.markComplete);
router.post("/:taskId/skip", requireAdminTeam, adminFacilityTaskController.markSkipped);

module.exports = router;
