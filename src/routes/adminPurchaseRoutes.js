const express = require("express");
const router = express.Router();
const adminPurchaseController = require("../controllers/adminPurchaseController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

router.get("/", adminPurchaseController.listPurchases);
router.get("/new", requireAdminTeam, adminPurchaseController.showNewForm);
router.post("/", requireAdminTeam, adminPurchaseController.createPurchase);
router.post("/:poId/approve", requireAdminTeam, adminPurchaseController.approve);
router.post("/:poId/receive", requireAdminTeam, adminPurchaseController.markReceived);
router.post("/:poId/pay", requireAdminTeam, adminPurchaseController.markPaid);
router.post("/:poId/cancel", requireAdminTeam, adminPurchaseController.cancel);

module.exports = router;
