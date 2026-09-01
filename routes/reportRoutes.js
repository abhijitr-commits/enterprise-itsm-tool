const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const executiveSummaryController = require("../controllers/executiveSummaryController");
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

router.get("/", guard("reports_view"), reportController.showReports);
router.get("/executive-summary", guard("reports_view"), executiveSummaryController.showExecutiveSummary);

module.exports = router;
