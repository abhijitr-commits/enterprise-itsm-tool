const express = require("express");
const router = express.Router();
const complaintController = require("../controllers/complaintController");
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

router.get("/", complaintController.listComplaints);
router.get("/mine", complaintController.myComplaints);
router.get("/new", guard("complaints_submit"), complaintController.showNewForm);
router.post("/", guard("complaints_submit"), complaintController.submitComplaint);
router.post("/:id/status", guard("complaints_manage"), complaintController.updateStatus);

module.exports = router;
