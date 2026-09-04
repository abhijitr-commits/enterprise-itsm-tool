const mongoose = require("mongoose");

/** Field-for-field port of the "Pulse Surveys" sheet (WellnessEngine.gs): Survey ID | Question | Created Date | Status. Single-question quick surveys ("How are you feeling about work this week? 1-5"). */
const pulseSurveySchema = new mongoose.Schema(
  {
    surveyId: { type: String, unique: true, index: true }, // PULSE-YYYY-000001
    question: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Open", "Closed"], default: "Open" },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

module.exports = mongoose.model("PulseSurvey", pulseSurveySchema);
