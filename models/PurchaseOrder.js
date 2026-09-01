const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Purchase Register" sheet (PurchaseEngine.gs):
 * PO ID | Date | Vendor | Item Description | Quantity | Amount |
 * Status. A purchase can optionally create a matching Asset Register
 * entry when marked "Received" — see purchaseController.js.
 */
const PURCHASE_STATUS = { ORDERED: "Ordered", RECEIVED: "Received", CANCELLED: "Cancelled" };

const purchaseOrderSchema = new mongoose.Schema(
  {
    poId: { type: String, unique: true, index: true }, // PO-YYYY-000001

    vendor: { type: String, required: true, trim: true },
    itemDescription: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: Object.values(PURCHASE_STATUS), default: PURCHASE_STATUS.ORDERED },
  },
  { timestamps: { createdAt: "date", updatedAt: false } }
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
module.exports.PURCHASE_STATUS = PURCHASE_STATUS;
