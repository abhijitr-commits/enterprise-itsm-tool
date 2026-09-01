const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    head: { type: String, trim: true }, // plain text, matching every other module's field convention
    location: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
