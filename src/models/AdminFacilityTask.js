const mongoose = require("mongoose");

/**
 * Admin (Administration-department) Facility Ops task log — the
 * recurring/one-off housekeeping and facility-upkeep task list
 * (cleaning rounds, pantry restocking, AC servicing checks, etc.).
 * No source spreadsheet for this one (unlike Stock Management's
 * Pashan Stock Register) — designed to match this app's existing
 * task/approval conventions: a simple Pending → Completed lifecycle,
 * the same shape as Scrap's status badges, with an optional Skipped
 * outcome for a task that didn't happen on its scheduled date.
 */
const FACILITY_TASK_FREQUENCY = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  ONE_TIME: "One-time",
};

const FACILITY_TASK_STATUS = { PENDING: "Pending", COMPLETED: "Completed", SKIPPED: "Skipped" };

const adminFacilityTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String, unique: true, index: true }, // ADTASK-YYYY-000001

    taskName: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    assignedStaff: { type: String, trim: true },
    frequency: { type: String, enum: Object.values(FACILITY_TASK_FREQUENCY), default: FACILITY_TASK_FREQUENCY.DAILY },
    scheduledDate: { type: Date, default: Date.now },
    status: { type: String, enum: Object.values(FACILITY_TASK_STATUS), default: FACILITY_TASK_STATUS.PENDING },
    completedDate: { type: Date },
    remarks: { type: String, trim: true },
    raisedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

adminFacilityTaskSchema.index({ status: 1, scheduledDate: 1 });

module.exports = mongoose.model("AdminFacilityTask", adminFacilityTaskSchema);
module.exports.FACILITY_TASK_FREQUENCY = FACILITY_TASK_FREQUENCY;
module.exports.FACILITY_TASK_STATUS = FACILITY_TASK_STATUS;
