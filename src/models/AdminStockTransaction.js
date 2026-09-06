const mongoose = require("mongoose");

/**
 * Admin stock counterpart to models/StockTransaction.js — same IN/OUT
 * ledger shape, separate collection tied to AdminStockItem instead of
 * StockItem. A "Mark Received" on an AdminStockOrder writes an IN row
 * here automatically (see adminStockController.js) so goods receipt
 * always shows up in the same history as a manual IN/OUT adjustment.
 */
const adminStockTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, unique: true, index: true }, // ASTKTX-YYYY-000001

    itemId: { type: String, required: true, trim: true, index: true },
    itemName: { type: String, trim: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, trim: true },
    performedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "date", updatedAt: false } }
);

module.exports = mongoose.model("AdminStockTransaction", adminStockTransactionSchema);
