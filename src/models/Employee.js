const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true, index: true }, // EMP-00001
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    designation: { type: String, trim: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    dateOfJoining: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employee", employeeSchema);
module.exports.PREFIX = ID_PREFIX.EMPLOYEE;
