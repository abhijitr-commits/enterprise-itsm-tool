const express = require("express");
const router = express.Router();
const adminOpsHubController = require("../controllers/adminOpsHubController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

router.get("/", requireAdminTeam, adminOpsHubController.showHub);

module.exports = router;
