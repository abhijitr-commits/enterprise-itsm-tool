const express = require("express");
const router = express.Router();
const itClearanceController = require("../controllers/itClearanceController");
const { requireLogin } = require("../middleware/auth");
const { requireITTeam } = require("../utils/teamAccess");

router.use(requireLogin);
router.use(requireITTeam);

router.get("/", itClearanceController.listPendingClearances);
router.get("/:resignationId", itClearanceController.showClearanceForm);
router.post("/:resignationId", itClearanceController.submitClearance);

module.exports = router;
