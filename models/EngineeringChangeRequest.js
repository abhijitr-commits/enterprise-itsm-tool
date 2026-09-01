const mongoose = require("mongoose");

/**
 * Phase 10 addition — no equivalent in the original. Deliberately
 * separate from the existing `Change` model (IT infrastructure CAB
 * changes — servers, network, software rollouts): this is a design/
 * product revision — a sensor swap, a firmware architecture change, a
 * mechanical redesign — for Designing/Technical/Software/Robotics/
 * Electrical/Electronics, with the same lightweight propose → review
 * → decide shape as `Change`'s CAB approval, but its own workflow so
 * approving an IT server change and approving a product design change
 * never share one queue or one permission key.
 */
const ECR_STATUS = {
  PROPOSED: "Proposed",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  IMPLEMENTED: "Implemented",
};

const ecrSchema = new mongoose.Schema(
  {
    ecrId: { type: String, unique: true, index: true }, // ECR-YYYY-000001

    title: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true }, // Designing/Technical/Software/Robotics/Electrical/Electronics/...
    relatedAsset: { type: String, trim: true }, // optional — the product/robot unit affected

    description: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    status: { type: String, enum: Object.values(ECR_STATUS), default: ECR_STATUS.PROPOSED },

    requestedBy: { type: String, trim: true },
    reviewedBy: { type: String, trim: true },
    reviewNotes: { type: String, trim: true },
    decidedDate: { type: Date },
  },
  { timestamps: { createdAt: "requestedDate", updatedAt: true } }
);

ecrSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model("EngineeringChangeRequest", ecrSchema);
module.exports.ECR_STATUS = ECR_STATUS;
