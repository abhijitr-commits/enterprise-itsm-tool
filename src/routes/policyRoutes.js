const express = require("express");
const router = express.Router();
const policyController = require("../controllers/policyController");
const { requireLogin } = require("../middleware/auth");
const { requireITTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Reading the active policy list is open to any signed-in user (matches
// getAllPoliciesSafe() — no permission check in the original); creating
// a policy and the compliance report are IT-team gated.
router.get("/", policyController.listPolicies);
router.get("/new", requireITTeam, policyController.showNewForm);
router.post("/", requireITTeam, policyController.createPolicy);
router.post("/:policyId/acknowledge", policyController.acknowledgePolicy);
router.get("/:policyId/compliance", requireITTeam, policyController.showCompliance);

module.exports = router;
