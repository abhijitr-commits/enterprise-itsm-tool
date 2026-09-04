const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const { hasPermission } = require("../utils/permissions");
const { isDelegatedApprover } = require("../utils/delegation");
const { requireLogin } = require("../middleware/auth");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

// Same as guard(), but also lets in a stand-in approval delegate —
// see utils/delegation.js. Only used for leave_approve, matching the
// original's isDelegatedApprover() scope exactly.
function guardOrDelegate(action) {
  return async (req, res, next) => {
    const allowed = (await hasPermission(req.user.role, action)) || (await isDelegatedApprover(req.user, action));
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", leaveController.listLeave);
router.get("/new", guard("leave_create"), leaveController.showNewForm);
router.post("/", guard("leave_create"), leaveController.createLeaveRequest);
router.post("/bulk-decide", guardOrDelegate("leave_approve"), leaveController.bulkDecideLeave);
router.post("/:id/decide", guardOrDelegate("leave_approve"), leaveController.decideLeave);

module.exports = router;
