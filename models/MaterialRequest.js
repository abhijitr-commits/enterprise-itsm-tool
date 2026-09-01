const mongoose = require("mongoose");

/**
 * Phase 10 addition — no equivalent in the original. Gives the Store
 * (inventory) team an inbound request queue instead of departments
 * walking up and asking verbally — any department requests an item
 * already tracked in `StockItem` (see models/StockItem.js), Store
 * issues it. Issuing a request genuinely records a real StockTransaction
 * OUT (via a new `recordTransactionInternal()` extracted in
 * stockController.js, the same "internal function backing a real
 * side effect" pattern as `issueAssetInternal()`), not just a status
 * flag — so Current Stock on the Store page stays provably correct.
 */
const MATERIAL_REQUEST_STATUS = { PENDING: "Pending", ISSUED: "Issued", REJECTED: "Rejected" };

const materialRequestSchema = new mongoose.Schema(
  {
    materialRequestId: { type: String, unique: true, index: true }, // MREQ-YYYY-000001

    requestedBy: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    itemName: { type: String, required: true, trim: true }, // matched against StockItem.itemName by name, same plain-string convention as everywhere else
    quantity: { type: Number, required: true },
    purpose: { type: String, trim: true },

    status: { type: String, enum: Object.values(MATERIAL_REQUEST_STATUS), default: MATERIAL_REQUEST_STATUS.PENDING },
    issuedBy: { type: String, trim: true },
    issuedDate: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: { createdAt: "requestedDate", updatedAt: false } }
);

module.exports = mongoose.model("MaterialRequest", materialRequestSchema);
module.exports.MATERIAL_REQUEST_STATUS = MATERIAL_REQUEST_STATUS;
