const mongoose = require("mongoose");
const { ID_PREFIX, LEAVE_TYPE } = require("../config/constants");
const { APPROVAL } = require("./ServiceRequest");

/**
 * Field-for-field port of the "Leave Requests" sheet (LeaveEngine.gs):
 * Leave ID | Employee | Leave Type | From Date | To Date | Days |
 * Reason | Status | Approver | Applied Date | Delegate To.
 *
 * leaveType is tightened to an enum here (the original accepted any
 * free-text string) because the balance calculations in
 * utils/leaveBalances.js filter by these exact names — a typo'd leave
 * type in the original would just silently never count toward any
 * balance, which is worse than not allowing it in the first place.
 * Reuses ServiceRequest's APPROVAL enum for status, same as Change.js
 * does for cabStatus — one Pending/Approved/Rejected vocabulary
 * across the whole app.
 */
const leaveRequestSchema = new mongoose.Schema(
  {
    leaveId: { type: String, unique: true, index: true }, // LV-YYYY-000001

    employee: { type: String, required: true, trim: true },
    leaveType: { type: String, enum: Object.values(LEAVE_TYPE), required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, trim: true },
    status: { type: String, enum: Object.values(APPROVAL), default: APPROVAL.PENDING },
    approver: { type: String, trim: true }, // email of whoever decided
    delegateTo: { type: String, trim: true }, // see Security.gs's isDelegatedApprover (not yet ported — see MIGRATION.md)

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "appliedDate", updatedAt: true } }
);

leaveRequestSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
module.exports.PREFIX = ID_PREFIX.LEAVE;
