const mongoose = require("mongoose");

/**
 * Admin (Administration-department) stock/inventory register — modeled
 * directly on the user-supplied "Pashan Stock Register" / "Inventory"
 * spreadsheets (facilities & housekeeping/pantry/stationery supplies:
 * room spray, tissue, batteries, etc.), which track quantity as
 * Boxes + Loose Pieces rather than a single flat count.
 *
 * Separate collection from models/StockItem.js (the existing IT/general
 * consumables register) — different domain, different unit shape
 * (piecesPerBox conversion, Minimum Buffer Stock/Critical Flag naming
 * straight from the sheet) — same "parallel module, not a shared one"
 * choice as AdminVendor.js next to Vendor.js.
 *
 * Current stock is still never stored as an editable number — same
 * "always derive from the transaction ledger" rule as StockItem.js, to
 * avoid drift. See AdminStockTransaction.js + adminStockController.js's
 * withCurrentStock().
 */
const adminStockItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, unique: true, index: true }, // ASTK-YYYY-000001
    itemCode: { type: String, trim: true }, // free-text code from the sheet, optional — not every row had one

    itemName: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "General" },
    unit: { type: String, trim: true, default: "pcs" },

    // Box + loose-piece tracking, straight from the sheet's "PC per Box" /
    // "Opening Boxes" / "Opening Loose PC" columns.
    piecesPerBox: { type: Number, default: 1, min: 1 },
    openingBoxes: { type: Number, default: 0, min: 0 },
    openingLoosePieces: { type: Number, default: 0, min: 0 },
    // Always openingBoxes * piecesPerBox + openingLoosePieces — stored
    // once at creation (same role as StockItem.openingStock) so the
    // current-stock derivation has one flat starting number to add
    // IN/OUT transactions on top of.
    openingStock: { type: Number, default: 0 },

    minBufferStock: { type: Number, default: 0 }, // sheet's "Minimum Buffer Stock" — this module's reorder level
    location: { type: String, trim: true },
    remarks: { type: String, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminStockItem", adminStockItemSchema);
