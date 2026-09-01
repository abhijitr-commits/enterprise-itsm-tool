const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Performance Reviews" sheet (PMSEngine.gs):
 * Review ID | Employee | Review Period | Reviewer | Rating (1-5) |
 * Strengths | Areas for Improvement | Review Date | Status.
 */
const REVIEW_STATUS = { SUBMITTED: "Submitted", ACKNOWLEDGED: "Acknowledged" };

const reviewSchema = new mongoose.Schema(
  {
    reviewId: { type: String, unique: true, index: true }, // REV-YYYY-000001
    employee: { type: String, required: true, trim: true },
    reviewPeriod: { type: String, required: true, trim: true },
    reviewer: { type: String, trim: true }, // email of whoever submitted it
    rating: { type: Number, min: 1, max: 5, required: true },
    strengths: { type: String, trim: true },
    areasForImprovement: { type: String, trim: true },
    status: { type: String, enum: Object.values(REVIEW_STATUS), default: REVIEW_STATUS.SUBMITTED },
  },
  { timestamps: { createdAt: "reviewDate", updatedAt: true } }
);

reviewSchema.index({ employee: 1 });

module.exports = mongoose.model("Review", reviewSchema);
module.exports.REVIEW_STATUS = REVIEW_STATUS;
