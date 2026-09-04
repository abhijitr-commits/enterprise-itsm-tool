const mongoose = require("mongoose");

/**
 * Port of the "Access Requests" sheet (AccessRequestEngine.gs): Request
 * ID | Employee | System/Application | Access Type | Justification |
 * Status | Approver | Requested Date | Completed Date.
 *
 * A dedicated workflow for password resets and system/application
 * access requests — separate from general Service Requests, since
 * these have a distinct approval need (usually IT security, not a
 * generic catalog item) and benefit from being tracked as their own
 * category.
 */
const ACCESS_REQUEST_TYPE = {
  NEW_ACCESS: "New Access",
  PASSWORD_RESET: "Password Reset",
  ACCESS_REVOKE: "Access Revoke",
  PERMISSION_CHANGE: "Permission Change",
};

const ACCESS_REQUEST_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

const accessRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, index: true }, // ACC-YYYY-000001

    employee: { type: String, required: true, trim: true },
    system: { type: String, required: true, trim: true },
    accessType: { type: String, enum: Object.values(ACCESS_REQUEST_TYPE), required: true },
    justification: { type: String, trim: true },
    status: { type: String, enum: Object.values(ACCESS_REQUEST_STATUS), default: ACCESS_REQUEST_STATUS.PENDING },
    approver: { type: String, trim: true },
    completedDate: { type: Date },
  },
  { timestamps: { createdAt: "requestedDate", updatedAt: false } }
);

module.exports = mongoose.model("AccessRequest", accessRequestSchema);
module.exports.ACCESS_REQUEST_TYPE = ACCESS_REQUEST_TYPE;
module.exports.ACCESS_REQUEST_STATUS = ACCESS_REQUEST_STATUS;
