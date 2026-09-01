const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
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

router.get("/", leaveController.listLeave);
router.get("/new", guard("leave_create"), leaveController.showNewForm);
router.post("/", guard("leave_create"), leaveController.createLeaveRequest);
router.post("/bulk-decide", guard("leave_approve"), leaveController.bulkDecideLeave);
router.post("/:id/decide", guard("leave_approve"), leaveController.decideLeave);

module.exports = router;
