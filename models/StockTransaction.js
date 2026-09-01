const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Stock Transactions" sheet (StockEngine.gs):
 * Transaction ID | Item ID | Item Name | Type | Quantity | Reason/
 * Reference | Date | Performed By. Every stock movement is logged as
 * one of these (IN or OUT) — see StockItem.js for why current stock is
 * always derived from this history rather than stored directly.
 */
const stockTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, unique: true, index: true }, // STKTX-YYYY-000001

    itemId: { type: String, required: true, trim: true, index: true },
    itemName: { type: String, trim: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, trim: true },
    performedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "date", updatedAt: false } }
);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
