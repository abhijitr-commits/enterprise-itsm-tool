const express = require("express");
const router = express.Router();
const checklistController = require("../controllers/checklistController");
const { requireLogin } = require("../middleware/auth");
const { isHRTeam, isAdminTeam } = require("../utils/teamAccess");

// Standard Onboarding/Offboarding checklists are HR-team gated; the
// Admin Onboarding/Offboarding ones (facilities/physical-return tasks)
// are Admin-team gated — same split as the original's
// toggleChecklistTask() (HR) vs toggleAdminOnboardingTask()/
// toggleAdminOffboardingTask() (Admin).
function guardForSlug(req, res, next) {
  const isAdminSlug = req.params.slug === "admin-onboarding" || req.params.slug === "admin-offboarding";
  const allowed = isAdminSlug ? isAdminTeam(req.user) : isHRTeam(req.user);
  if (!allowed) {
    return res.status(403).render("errors/403", { action: isAdminSlug ? "Admin team only" : "HR team only" });
  }
  next();
}

router.use(requireLogin);
router.use("/:slug", guardForSlug);

router.get("/:slug", checklistController.listChecklist);
router.post("/:slug", checklistController.createChecklist);
router.post("/:slug/:id/toggle", checklistController.toggleTask);

// Pre-Onboarding Detail — only meaningful under the "pre-onboarding"
// slug (the controller itself 404s any other slug); nested under
// "/:slug" so it inherits guardForSlug's HR-team gate above.
router.get("/:slug/:employee/detail", checklistController.showPreOnboardingDetail);
router.post("/:slug/:employee/detail/contact", checklistController.savePreOnboardingContact);
router.post("/:slug/:employee/detail/joining-date", checklistController.confirmJoiningDate);
router.post("/:slug/:employee/detail/welcome-kit", checklistController.saveWelcomeKit);

module.exports = router;
