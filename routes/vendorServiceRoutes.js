const express = require("express");
const router = express.Router();
const vendorServiceController = require("../controllers/vendorServiceController");
const { requireLogin } = require("../middleware/auth");
const { requireITTeam } = require("../utils/teamAccess");

router.use(requireLogin);
router.use(requireITTeam);

router.get("/", vendorServiceController.listLogs);
router.post("/", vendorServiceController.logIssue);
router.post("/:id/status", vendorServiceController.updateStatus);

module.exports = router;
