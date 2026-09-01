const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

/**
 * Field-for-field port of the "Employees" sheet (EmployeeEngine.gs):
 * Employee ID | Name | Email | Department | Location | Designation |
 * Status | Employment Type | Contract End Date | Reports To.
 *
 * department/location/reportsTo are plain trimmed strings, matching
 * the convention used by every other module (see Incident.js etc.) —
 * Department/Location are lookup tables an admin manages via Master
 * Data, but nothing here needs a real relational join yet, and
 * reportsTo matches by employee NAME (same as the original's
 * OrgChartEngine, which resolves the hierarchy by name too).
 */
const EMPLOYMENT_TYPE = { ON_ROLL: "On-Roll", CONTRACT: "Contract" };

// "New" drives onboarding automation, "Left" drives offboarding
// automation (see employeeController.js) — same trigger as the
// original's updateEmployee().
const EMPLOYEE_STATUS = { NEW: "New", ACTIVE: "Active", LEFT: "Left" };

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true, index: true }, // EMP-000001

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    designation: { type: String, trim: true },
    status: { type: String, enum: Object.values(EMPLOYEE_STATUS), default: EMPLOYEE_STATUS.NEW },
    employmentType: { type: String, enum: Object.values(EMPLOYMENT_TYPE), default: EMPLOYMENT_TYPE.ON_ROLL },
    contractEndDate: { type: Date },
    reportsTo: { type: String, trim: true }, // another employee's Name, blank = top-level

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

employeeSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
module.exports.PREFIX = ID_PREFIX.EMPLOYEE;
module.exports.EMPLOYMENT_TYPE = EMPLOYMENT_TYPE;
module.exports.EMPLOYEE_STATUS = EMPLOYEE_STATUS;
