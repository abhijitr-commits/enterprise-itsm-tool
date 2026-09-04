const express = require("express");
const router = express.Router();
const wellnessController = require("../controllers/wellnessController");
const { requireLogin } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

// Wellness Programs — viewing open to all, creating "wellness_manage".
router.get("/programs", wellnessController.listPrograms);
router.get("/programs/new", guard("wellness_manage"), wellnessController.showNewProgramForm);
router.post("/programs", guard("wellness_manage"), wellnessController.createProgram);

// Pulse Surveys — the active survey + submitting a response are open to
// everyone (and anonymous, see wellnessController.js); creating a
// survey and viewing results are gated, same split as the original.
router.get("/pulse", wellnessController.showPulse);
router.post("/pulse/respond", wellnessController.submitResponse);
router.get("/pulse/new", guard("wellness_manage"), wellnessController.showNewSurveyForm);
router.post("/pulse", guard("wellness_manage"), wellnessController.createSurvey);
router.get("/pulse/results", guard("reports_view"), wellnessController.pulseResults);
router.post("/pulse/:id/close", guard("wellness_manage"), wellnessController.closeSurvey);

// Kudos — the wall is open to everyone; giving kudos is "kudos_give"
// (every role, by default).
router.get("/kudos", wellnessController.listKudos);
router.post("/kudos", guard("kudos_give"), wellnessController.giveKudos);

module.exports = router;
