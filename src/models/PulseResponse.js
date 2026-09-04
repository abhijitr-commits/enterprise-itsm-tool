const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Pulse Responses" sheet (WellnessEngine.gs):
 * Response ID | Survey ID | Rating (1-5) | Comment | Submitted Date.
 * Deliberately anonymous — no employee name or user reference is
 * stored, matching the original exactly.
 */
const pulseResponseSchema = new mongoose.Schema(
  {
    responseId: { type: String, unique: true, index: true }, // PRESP-YYYY-000001
    surveyId: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },
  },
  { timestamps: { createdAt: "submittedDate", updatedAt: false } }
);

pulseResponseSchema.index({ surveyId: 1 });

module.exports = mongoose.model("PulseResponse", pulseResponseSchema);
