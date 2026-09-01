const express = require("express");
const router = express.Router();
const recruitmentController = require("../controllers/recruitmentController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", recruitmentController.listJobs);
router.get("/new", guard("recruitment_manage"), recruitmentController.showNewJobForm);
router.post("/", guard("recruitment_manage"), recruitmentController.createJob);
router.post("/:jobId/close", guard("recruitment_manage"), recruitmentController.closeJob);
router.get("/:jobId/candidates", recruitmentController.listCandidates);
router.post("/:jobId/candidates", guard("recruitment_manage"), recruitmentController.addCandidate);
router.post("/candidates/:id/stage", guard("recruitment_manage"), recruitmentController.updateCandidateStage);

module.exports = router;
