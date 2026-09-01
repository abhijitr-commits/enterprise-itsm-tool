const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Candidates" sheet (ATSEngine.gs):
 * Candidate ID | Job ID | Job Title | Name | Email | Phone | Stage |
 * Applied Date | Resume Link | Notes. jobTitle is denormalized
 * alongside jobId, same as the original, so a candidate's row still
 * reads correctly even if the job posting is edited later.
 */
const CANDIDATE_STAGES = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

const candidateSchema = new mongoose.Schema(
  {
    candidateId: { type: String, unique: true, index: true }, // CAN-YYYY-000001
    jobId: { type: String, required: true, trim: true },
    jobTitle: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    stage: { type: String, enum: CANDIDATE_STAGES, default: "Applied" },
    resumeLink: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: "appliedDate", updatedAt: true } }
);

candidateSchema.index({ jobId: 1, stage: 1 });

module.exports = mongoose.model("Candidate", candidateSchema);
module.exports.CANDIDATE_STAGES = CANDIDATE_STAGES;
