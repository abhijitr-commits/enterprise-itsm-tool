const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Attendance" sheet (AttendanceEngine.gs):
 * Date | Employee | Check In | Check Out | Hours. A simple honor-system
 * log (people click a button), not biometric/geofenced tracking — same
 * caveat as the original.
 */
const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // yyyy-MM-dd, so "today" lookups are a plain string match
    employee: { type: String, required: true, trim: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    hours: { type: Number },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
