const express = require("express");
const router = express.Router();
const adminScrapController = require("../controllers/adminScrapController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Same read-open/write-gated split as adminVendorRoutes.js and
// adminStockRoutes.js — a register lookup needs no special permission,
// Admin-team gated for raising/approving/disposing entries.
router.get("/", adminScrapController.listScrap);
router.get("/new", requireAdminTeam, adminScrapController.showNewForm);
router.post("/", requireAdminTeam, adminScrapController.createScrap);
router.post("/:scrapId/approve", requireAdminTeam, adminScrapController.approve);
router.post("/:scrapId/dispose", requireAdminTeam, adminScrapController.dispose);
router.post("/:scrapId/cancel", requireAdminTeam, adminScrapController.cancel);

module.exports = router;
