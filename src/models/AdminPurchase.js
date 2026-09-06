const mongoose = require("mongoose");

/**
 * Admin (Administration-department) procurement register — non-stock
 * purchases (furniture, equipment, services, one-off buys) that don't
 * belong in Stock Management's per-item ledger. Same 3-stage approval
 * shape as adminScrapController.js's Pending Approval → Approved →
 * Disposed and adminStockController.js's Order → Received: here it's
 * Pending Approval → Approved → Received, with Cancelled as an escape
 * hatch from either open state. Reference Bill No / Payment Status /
 * Payment Date mirror AdminStockOrder.js's own receiving fields, kept
 * consistent across this app's purchasing-flavoured registers.
 */
const ADMIN_PURCHASE_STATUS = {
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS = { UNPAID: "Unpaid", PAID: "Paid" };

const adminPurchaseSchema = new mongoose.Schema(
  {
    poId: { type: String, unique: true, index: true }, // ADPO-YYYY-000001

    itemDescription: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "General" },
    quantity: { type: Number, default: 1, min: 1 },
    estimatedAmount: { type: Number, default: 0, min: 0 },
    vendor: { type: String, trim: true },

    status: { type: String, enum: Object.values(ADMIN_PURCHASE_STATUS), default: ADMIN_PURCHASE_STATUS.PENDING_APPROVAL },
    approvedBy: { type: String, trim: true },
    approvedDate: { type: Date },

    receivedDate: { type: Date },
    referenceBillNo: { type: String, trim: true },
    actualAmount: { type: Number, min: 0 },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID },
    paymentDate: { type: Date },

    remarks: { type: String, trim: true },
    raisedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminPurchase", adminPurchaseSchema);
module.exports.ADMIN_PURCHASE_STATUS = ADMIN_PURCHASE_STATUS;
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
