const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/maintenanceController");
const { requireLogin } = require("../middleware/auth");
const { requireITTeam } = require("../utils/teamAccess");

router.use(requireLogin);

router.get("/", maintenanceController.listAnnouncements);
router.get("/new", requireITTeam, maintenanceController.showNewForm);
router.post("/", requireITTeam, maintenanceController.createAnnouncement);

module.exports = router;
