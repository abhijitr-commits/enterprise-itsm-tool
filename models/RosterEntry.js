const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Shift Roster" sheet (ShiftEngine.gs):
 * Roster ID | Employee | Shift ID | Shift Name | Date. shiftName is
 * denormalized alongside shiftId, same as the original sheet, so the
 * roster still reads correctly even if a shift is later renamed.
 */
const rosterEntrySchema = new mongoose.Schema(
  {
    rosterId: { type: String, unique: true, index: true }, // ROSTER-YYYY-000001
    employee: { type: String, required: true, trim: true },
    shiftId: { type: String, required: true, trim: true },
    shiftName: { type: String, trim: true },
    date: { type: String, required: true, index: true }, // yyyy-MM-dd
  },
  { timestamps: true }
);

rosterEntrySchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("RosterEntry", rosterEntrySchema);
