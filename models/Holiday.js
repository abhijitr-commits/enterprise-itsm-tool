const mongoose = require("mongoose");

/** Mirrors the "Holidays" sheet — used by the SLA business-hours calculator. */
const holidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String, trim: true },
});

module.exports = mongoose.model("Holiday", holidaySchema);
