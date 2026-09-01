const express = require("express");
const router = express.Router();
const accessRequestController = require("../controllers/accessRequestController");
const { requireLogin } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");
const { requireITTeam } = require("../utils/teamAccess");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/new", guard("access_requests_submit"), accessRequestController.showNewForm);
router.post("/", guard("access_requests_submit"), accessRequestController.submitAccessRequest);
router.get("/mine", accessRequestController.myAccessRequests);
router.get("/", requireITTeam, accessRequestController.listAccessRequests);
router.post("/:id/status", requireITTeam, accessRequestController.updateStatus);

module.exports = router;
