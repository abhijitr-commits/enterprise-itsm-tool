const mongoose = require("mongoose");

/**
 * Phase 10 addition — no equivalent in the original 116-file project,
 * which was purely an internal-IT/HR/facilities tool with no customer-
 * facing sales tracking at all. Built for the Sales department at a
 * lightweight "enquiry through delivery" level (not a full CRM) —
 * enough to give Sales a shared, auditable order list instead of a
 * spreadsheet, and enough for Production/Logistics to see what's been
 * sold and needs building/shipping (via `salesOrderId`, matched by
 * plain string the same way every other cross-module reference in
 * this app works — see WorkOrder.relatedSalesOrder).
 */
const SALES_ORDER_STATUS = {
  ENQUIRY: "Enquiry",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const salesOrderSchema = new mongoose.Schema(
  {
    salesOrderId: { type: String, unique: true, index: true }, // SO-YYYY-000001

    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true },
    itemDescription: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 1 },
    amount: { type: Number },
    status: { type: String, enum: Object.values(SALES_ORDER_STATUS), default: SALES_ORDER_STATUS.ENQUIRY },
    expectedDeliveryDate: { type: Date },
    notes: { type: String, trim: true },

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

module.exports = mongoose.model("SalesOrder", salesOrderSchema);
module.exports.SALES_ORDER_STATUS = SALES_ORDER_STATUS;
