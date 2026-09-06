const mongoose = require("mongoose");

/**
 * Scrap Management — the Administration-department register of items
 * taken out of active stock/use (damaged, expired, obsolete) and their
 * disposal. No source spreadsheet was supplied for this one (unlike
 * AdminVendor/AdminStockItem, ported from the user's real workbooks);
 * built to the same shape as this app's other Admin registers — a
 * request/approval/completion lifecycle, same as AdminStockOrder's
 * Pending → Received.
 *
 * Deliberately its own collection rather than a status on
 * AdminStockItem — a scrapped item is leaving the register for good
 * (with a reason, an approval, and — if sold as scrap — a recovered
 * value), which is a different shape than "this item's stock moved."
 * A scrap entry against a stock item does still reduce that item's
 * Closing Stock (PC) via a real AdminStockTransaction OUT, the same
 * "record a real transaction" rule used everywhere else in this
 * module — see adminScrapController.js.
 */
const DISPOSAL_METHOD = {
  RECYCLED: "Recycled",
  SOLD: "Sold",
  DISCARDED: "Discarded",
  DONATED: "Donated",
  OTHER: "Other",
};

const SCRAP_STATUS = {
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  DISPOSED: "Disposed",
};

const adminScrapItemSchema = new mongoose.Schema(
  {
    scrapId: { type: String, unique: true, index: true }, // SCRAP-YYYY-000001

    itemCode: { type: String, trim: true }, // optional — the Stock Management item code this scrap came from, if any
    itemName: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "General" },
    quantity: { type: Number, default: 1, min: 1 },
    unit: { type: String, trim: true, default: "pcs" },

    reason: { type: String, required: true, trim: true }, // why it's being scrapped (damaged, expired, obsolete, ...)
    scrapDate: { type: Date, default: Date.now },

    status: { type: String, enum: Object.values(SCRAP_STATUS), default: SCRAP_STATUS.PENDING_APPROVAL },
    approvedBy: { type: String, trim: true },
    approvedDate: { type: Date },

    disposalMethod: { type: String, enum: Object.values(DISPOSAL_METHOD) },
    valueRecovered: { type: Number, default: 0, min: 0 }, // sale value, if disposed as Sold
    disposedDate: { type: Date },

    remarks: { type: String, trim: true },
    raisedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminScrapItem", adminScrapItemSchema);
module.exports.DISPOSAL_METHOD = DISPOSAL_METHOD;
module.exports.SCRAP_STATUS = SCRAP_STATUS;
