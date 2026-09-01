const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Performance Goals" sheet (PMSEngine.gs):
 * Goal ID | Employee | Goal Title | Description | Target Date | Status |
 * Progress % | Created Date.
 */
const GOAL_STATUS = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };

const goalSchema = new mongoose.Schema(
  {
    goalId: { type: String, unique: true, index: true }, // GOAL-YYYY-000001
    employee: { type: String, required: true, trim: true },
    goalTitle: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    targetDate: { type: Date },
    status: { type: String, enum: Object.values(GOAL_STATUS), default: GOAL_STATUS.NOT_STARTED },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

goalSchema.index({ employee: 1 });

module.exports = mongoose.model("Goal", goalSchema);
module.exports.GOAL_STATUS = GOAL_STATUS;
