const express = require("express");
const router = express.Router();
const systemPolicyController = require("../controllers/systemPolicyController");
const { requireLogin } = require("../middleware/auth");
const { requireHRTeam } = require("../utils/teamAccess");

router.use(requireLogin);
router.use(requireHRTeam);

router.get("/", systemPolicyController.showPolicies);
router.post("/", systemPolicyController.savePolicies);

module.exports = router;
