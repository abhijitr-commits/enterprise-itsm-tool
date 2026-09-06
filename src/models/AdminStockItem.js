const mongoose = require("mongoose");

/**
 * Admin (Administration-department) stock/inventory register — a
 * field-for-field port of the "Inventory" sheet in the user-supplied
 * Pashan Stock Register spreadsheet (facilities & housekeeping/pantry/
 * stationery supplies: room spray, tissue, batteries, etc.), which
 * tracks quantity as Boxes + Loose Pieces rather than a single flat
 * count. Column names below are kept identical to the sheet's own
 * headers so the app reads the same way the spreadsheet did.
 *
 * Separate collection from models/StockItem.js (the existing IT/general
 * consumables register) — different domain, same "parallel module, not
 * a shared one" choice as AdminVendor.js next to Vendor.js.
 *
 * Fields the sheet computed with a formula (Issued/Used, Closing
 * Stock, Critical Flag/Status, Qty to Order, Display Stock) are NOT
 * stored here — same "never store what can drift" rule as
 * models/StockItem.js: current stock is always derived from the
 * AdminStockTransaction ledger, never an editable number. See
 * adminStockController.js's withCurrentStock() for where those
 * computed columns actually get produced.
 */
const adminStockItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, unique: true, index: true }, // ASTK-YYYY-000001
    itemCode: { type: String, trim: true }, // sheet's "Item Code" — free text, optional (not every row had one)

    itemName: { type: String, required: true, trim: true }, // sheet's "Item Name"
    category: { type: String, trim: true, default: "General" }, // not a sheet column — added so items can be grouped/reported on
    unit: { type: String, trim: true, default: "pcs" }, // not a sheet column — display unit, defaults to the sheet's own "pc" usage

    piecesPerBox: { type: Number, default: 1, min: 1 }, // sheet's "PC per Box"
    openingBoxes: { type: Number, default: 0, min: 0 }, // sheet's "Opening Boxes"
    openingLoosePieces: { type: Number, default: 0, min: 0 }, // sheet's "Opening Loose PC"
    // Sheet's "Opening Stock" — always openingBoxes * piecesPerBox +
    // openingLoosePieces, stored once at creation so the current-stock
    // derivation has one flat starting number to add IN/OUT
    // transactions (Received/Issued) on top of.
    openingStock: { type: Number, default: 0 },

    minBufferStock: { type: Number, default: 0 }, // sheet's "Minimum Buffer Stock"

    // Sheet's "Order" column — a quick per-item reorder decision flag
    // (its own "Lists" tab enumerates exactly Hold/Order/Done), separate
    // from the full Stock Order Management history in AdminStockOrder.
    // Settable directly, and kept in sync automatically by the Order
    // workflow: raising an order sets this to "Order", marking it
    // received sets it to "Done".
    orderFlag: { type: String, enum: ["Hold", "Order", "Done"], default: "Hold" },

    location: { type: String, trim: true },
    remarks: { type: String, trim: true }, // sheet's "Remarks"
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminStockItem", adminStockItemSchema);
