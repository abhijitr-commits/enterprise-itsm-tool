const express = require("express");
const router = express.Router();
const adminStockController = require("../controllers/adminStockController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Same read-open/write-gated split as stockRoutes.js. The /orders
// routes are registered ahead of /:itemId/transactions so a literal
// "orders" path segment is never mistaken for an item ID.
router.get("/", adminStockController.listStock);
router.get("/new", requireAdminTeam, adminStockController.showNewForm);
router.post("/", requireAdminTeam, adminStockController.createItem);

router.get("/orders", adminStockController.listOrders);
router.get("/orders/new", requireAdminTeam, adminStockController.showNewOrderForm);
router.post("/orders", requireAdminTeam, adminStockController.createOrder);
router.post("/orders/:orderId/receive", requireAdminTeam, adminStockController.markReceived);
router.post("/orders/:orderId/payment", requireAdminTeam, adminStockController.updatePayment);

router.get("/:itemId/transactions", adminStockController.itemTransactions);
router.post("/:itemId/transactions", requireAdminTeam, adminStockController.recordTransaction);

module.exports = router;
