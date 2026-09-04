const express = require("express");
const router = express.Router();
const trainingController = require("../controllers/trainingController");
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

// Catalog — viewing is open to any signed-in user (matches the
// original's getAllCoursesSafe(), no permission check); adding courses,
// enrolling, and updating status are all "training_manage" (Admin/Manager).
router.get("/courses", trainingController.listCourses);
router.get("/courses/new", guard("training_manage"), trainingController.showNewCourseForm);
router.post("/courses", guard("training_manage"), trainingController.createCourse);

router.get("/enrollments", guard("training_manage"), trainingController.listEnrollments);
router.post("/enrollments", guard("training_manage"), trainingController.enrollEmployee);
router.post("/enrollments/:id/status", guard("training_manage"), trainingController.updateEnrollmentStatus);

// Certificates — self-service, ownership-checked inside the controller.
router.get("/certificates", trainingController.myCertificates);
router.get("/certificates/:certificateId", trainingController.showCertificate);

module.exports = router;
