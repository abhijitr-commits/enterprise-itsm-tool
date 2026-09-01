const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Exit Interviews" sheet
 * (OnboardingEngine.gs) — a structured record, separate from the
 * Resignation's free-text "Exit Interview Notes" column, so satisfaction
 * data can actually be aggregated later (e.g. average rating of people
 * who left this year).
 */
const exitInterviewSchema = new mongoose.Schema(
  {
    interviewId: { type: String, unique: true, index: true }, // EXIT-YYYY-000001
    resignationId: { type: String, required: true, trim: true, index: true },

    employee: { type: String, required: true, trim: true },
    primaryReason: { type: String, trim: true },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    wouldRecommend: { type: String, trim: true },
    managerFeedback: { type: String, trim: true },
    suggestions: { type: String, trim: true },
    conductedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "completedDate", updatedAt: false } }
);

module.exports = mongoose.model("ExitInterview", exitInterviewSchema);
