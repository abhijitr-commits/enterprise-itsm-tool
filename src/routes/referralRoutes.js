const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referralController");
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

router.get("/", referralController.listMyReferrals);
router.get("/new", guard("referrals_submit"), referralController.showNewForm);
router.post("/", guard("referrals_submit"), referralController.submitReferral);
router.post("/:id", guard("referrals_manage"), referralController.updateReferral);

module.exports = router;
