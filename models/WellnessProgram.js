const mongoose = require("mongoose");

/** Field-for-field port of the "Wellness Programs" sheet (WellnessEngine.gs): Program ID | Title | Type | Date | Description | Status. A calendar of events — physical/mental/financial/social wellness. */
const wellnessProgramSchema = new mongoose.Schema(
  {
    programId: { type: String, unique: true, index: true }, // WEL-YYYY-000001
    title: { type: String, required: true, trim: true },
    type: { type: String, trim: true, default: "General" },
    date: { type: Date },
    description: { type: String, trim: true },
    status: { type: String, enum: ["Upcoming", "Completed", "Cancelled"], default: "Upcoming" },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WellnessProgram", wellnessProgramSchema);
