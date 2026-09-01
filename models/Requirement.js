const mongoose = require("mongoose");

/**
 * Port of the "Requirement Requests" sheet (RequirementEngine.gs):
 * Requirement ID | Raised By | Department | Vendor Name | Vendor Email
 * | Requirement Description | Priority | Status | Sent Date | Notes.
 *
 * A lightweight RFQ (Request for Quotation) style workflow — genuinely
 * distinct from the Purchase Register, which tracks completed POs.
 * This tracks the REQUEST/NEGOTIATION phase before a PO exists.
 * Usable by both IT and Admin/Procurement (see requirementController.js).
 */
const REQUIREMENT_STATUS = {
  SENT: "Sent",
  ACKNOWLEDGED: "Acknowledged",
  QUOTED: "Quoted",
  FULFILLED: "Fulfilled",
  REJECTED: "Rejected",
};

const requirementSchema = new mongoose.Schema(
  {
    requirementId: { type: String, unique: true, index: true }, // REQMT-YYYY-000001

    raisedBy: { type: String, trim: true },
    department: { type: String, trim: true },
    vendorName: { type: String, trim: true },
    vendorEmail: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["Normal", "Critical"], default: "Normal" },
    status: { type: String, enum: Object.values(REQUIREMENT_STATUS), default: REQUIREMENT_STATUS.SENT },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: "sentDate", updatedAt: false } }
);

module.exports = mongoose.model("Requirement", requirementSchema);
module.exports.REQUIREMENT_STATUS = REQUIREMENT_STATUS;
