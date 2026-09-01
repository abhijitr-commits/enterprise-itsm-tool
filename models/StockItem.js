const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Stock Items" sheet (StockEngine.gs):
 * Item ID | Item Name | Category | Unit | Opening Stock | Reorder
 * Level | Location | Status.
 *
 * Tracks consumable/bulk inventory (cables, toner, spare parts,
 * stationery, etc.) — different from the Asset Register, which tracks
 * individual serialized hardware assigned to one person. Current stock
 * is deliberately NOT stored here as an editable number (see
 * StockTransaction.js) — it's always calculated as Opening Stock + all
 * IN - all OUT, so the number shown is always provably correct from
 * the transaction history, never something that can silently drift.
 */
const stockItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, unique: true, index: true }, // STK-YYYY-000001

    itemName: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "General" },
    unit: { type: String, trim: true, default: "pcs" },
    openingStock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    location: { type: String, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockItem", stockItemSchema);
