const mongoose = require("mongoose");

/**
 * Field-for-field port of the "IT Policies" sheet
 * (PolicyAcknowledgmentEngine.gs): Policy ID | Policy Name | Version |
 * Content | Created Date | Created By | Active. "Active" (Yes/No in
 * the original) is a real boolean here — same meaning: only active
 * policies are shown to employees for acknowledgment.
 */
const policySchema = new mongoose.Schema(
  {
    policyId: { type: String, unique: true, index: true }, // POL-YYYY-000001
    policyName: { type: String, required: true, trim: true },
    version: { type: String, trim: true, default: "1.0" },
    content: { type: String, required: true },
    createdBy: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

module.exports = mongoose.model("Policy", policySchema);
