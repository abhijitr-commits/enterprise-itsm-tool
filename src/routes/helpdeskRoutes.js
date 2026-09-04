const express = require("express");
const router = express.Router();
const helpdeskController = require("../controllers/helpdeskController");
const { requireLogin } = require("../middleware/auth");
const { requireITTeam } = require("../utils/teamAccess");

router.use(requireLogin);
router.use(requireITTeam);

router.get("/", helpdeskController.showHelpdesk);

module.exports = router;
