const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Policy Acknowledgments" sheet
 * (PolicyAcknowledgmentEngine.gs): Acknowledgment ID | Policy ID |
 * Policy Name | Employee | Acknowledged Date. policyName is
 * denormalized alongside policyId, same pattern used throughout this
 * migration (Candidate.jobTitle, Enrollment.courseTitle, etc.).
 */
const policyAcknowledgmentSchema = new mongoose.Schema(
  {
    ackId: { type: String, unique: true, index: true }, // ACK-YYYY-000001
    policyId: { type: String, required: true, trim: true },
    policyName: { type: String, trim: true },
    employee: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: "acknowledgedDate", updatedAt: false } }
);

policyAcknowledgmentSchema.index({ policyId: 1, employee: 1 }, { unique: true });

module.exports = mongoose.model("PolicyAcknowledgment", policyAcknowledgmentSchema);
