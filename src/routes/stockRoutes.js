const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Reads are open to everyone signed in — same as the original, which
// puts no permission check on getAllStockItemsSafe()/getStockTransactionsForItem().
// Writes (create item, IN/OUT transactions) are Admin-team gated,
// matching requireAdminTeam() throughout StockEngine.gs.
router.get("/", stockController.listStock);
router.get("/new", requireAdminTeam, stockController.showNewForm);
router.post("/", requireAdminTeam, stockController.createItem);
router.get("/:itemId/transactions", stockController.itemTransactions);
router.post("/:itemId/transactions", requireAdminTeam, stockController.recordTransaction);

module.exports = router;
