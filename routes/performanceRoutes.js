const express = require("express");
const router = express.Router();
const performanceController = require("../controllers/performanceController");
const { requireLogin } = require("../middleware/auth");
const { requireHRTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Goals — reading is open to any signed-in user (matches the original,
// same as Leave/Recruitment lists); creating is HR-team-only; updating
// progress is ownership-checked inside the controller (self or HR team).
router.get("/goals", performanceController.listGoals);
router.get("/goals/new", requireHRTeam, performanceController.showNewGoalForm);
router.post("/goals", requireHRTeam, performanceController.createGoal);
router.post("/goals/:id/progress", performanceController.updateGoalProgress);

// Reviews — same pattern: read open, create HR-team-only, acknowledge
// ownership-checked inside the controller (employee only).
router.get("/reviews", performanceController.listReviews);
router.get("/reviews/new", requireHRTeam, performanceController.showNewReviewForm);
router.post("/reviews", requireHRTeam, performanceController.createReview);
router.post("/reviews/:id/acknowledge", performanceController.acknowledgeReview);

module.exports = router;
