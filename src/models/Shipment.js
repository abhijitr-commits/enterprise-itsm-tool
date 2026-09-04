const mongoose = require("mongoose");

/**
 * Phase 10 addition — no equivalent in the original. Covers Logistics:
 * both inbound (component/material deliveries from Vendors, matched
 * loosely against `relatedOrder`) and outbound (finished-goods
 * dispatch to a customer, matched against a SalesOrder ID) shipments,
 * one shared collection with a `direction` field rather than two
 * parallel modules — same "one model, a discriminator field" pattern
 * used by WorkOrder and, before this phase, Checklist/Room.
 */
const SHIPMENT_DIRECTION = { INBOUND: "Inbound", OUTBOUND: "Outbound" };
const SHIPMENT_STATUS = {
  PREPARING: "Preparing",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  DELAYED: "Delayed",
  CANCELLED: "Cancelled",
};

const shipmentSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, unique: true, index: true }, // SHIP-YYYY-000001

    direction: { type: String, enum: Object.values(SHIPMENT_DIRECTION), required: true },
    relatedOrder: { type: String, trim: true }, // optional — SalesOrder.salesOrderId (outbound) or a PO/vendor reference (inbound)
    carrier: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    origin: { type: String, trim: true },
    destination: { type: String, trim: true },
    status: { type: String, enum: Object.values(SHIPMENT_STATUS), default: SHIPMENT_STATUS.PREPARING },
    dispatchDate: { type: Date },
    expectedDeliveryDate: { type: Date },
    actualDeliveryDate: { type: Date },
    notes: { type: String, trim: true },

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

shipmentSchema.index({ direction: 1, status: 1 });

module.exports = mongoose.model("Shipment", shipmentSchema);
module.exports.SHIPMENT_DIRECTION = SHIPMENT_DIRECTION;
module.exports.SHIPMENT_STATUS = SHIPMENT_STATUS;
