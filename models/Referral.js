const mongoose = require("mongoose");
const { CANDIDATE_STAGES } = require("./Candidate");

/**
 * Field-for-field port of the "Referrals" sheet (ReferralEngine.gs):
 * Referral ID | Referrer | Candidate Name | Candidate Email | Job ID |
 * Job Title | Status | Reward Status | Submitted Date. Status reuses
 * the same stage vocabulary as Candidate.CANDIDATE_STAGES (plus
 * "Submitted" as the initial value) since a referral tracks the same
 * candidate through the same pipeline — the original left `status`
 * as free text, but every value it actually set was one of these.
 */
const REFERRAL_STATUS = ["Submitted", ...CANDIDATE_STAGES];
const REWARD_STATUS = { PENDING: "Pending", PAID: "Paid" };

const referralSchema = new mongoose.Schema(
  {
    referralId: { type: String, unique: true, index: true }, // REF-YYYY-000001
    referrer: { type: String, required: true, trim: true },
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, trim: true, lowercase: true },
    jobId: { type: String, required: true, trim: true },
    jobTitle: { type: String, trim: true },
    status: { type: String, enum: REFERRAL_STATUS, default: "Submitted" },
    rewardStatus: { type: String, enum: Object.values(REWARD_STATUS), default: REWARD_STATUS.PENDING },
  },
  { timestamps: { createdAt: "submittedDate", updatedAt: false } }
);

module.exports = mongoose.model("Referral", referralSchema);
module.exports.REFERRAL_STATUS = REFERRAL_STATUS;
module.exports.REWARD_STATUS = REWARD_STATUS;
