const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Succession Plans" sheet (SuccessionEngine.gs):
 * Plan ID | Position/Role | Current Holder | Department | Successor 1 |
 * Successor 1 Readiness | Successor 2 | Successor 2 Readiness | Notes |
 * Last Updated.
 */
const READINESS_LEVELS = ["Ready Now", "1-2 Years", "3+ Years"];

const successionPlanSchema = new mongoose.Schema(
  {
    planId: { type: String, unique: true, index: true }, // SUCC-YYYY-000001
    position: { type: String, required: true, trim: true },
    currentHolder: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    successor1: { type: String, trim: true },
    successor1Readiness: { type: String, enum: [...READINESS_LEVELS, ""], default: "" },
    successor2: { type: String, trim: true },
    successor2Readiness: { type: String, enum: [...READINESS_LEVELS, ""], default: "" },
    notes: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "lastUpdated" } }
);

module.exports = mongoose.model("SuccessionPlan", successionPlanSchema);
module.exports.READINESS_LEVELS = READINESS_LEVELS;
