const mongoose = require("mongoose");

/** Field-for-field port of the "Shifts" sheet (ShiftEngine.gs): Shift ID | Shift Name | Start Time | End Time. */
const shiftSchema = new mongoose.Schema(
  {
    shiftId: { type: String, unique: true, index: true }, // SHIFT-YYYY-000001
    shiftName: { type: String, required: true, trim: true },
    startTime: { type: String, trim: true }, // "09:00" — kept as plain text, same as the original sheet cell
    endTime: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shift", shiftSchema);
