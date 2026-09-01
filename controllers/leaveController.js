/*************************************************************
 * leaveController.js — port of LeaveEngine.gs. Reading the leave
 * list is open to any signed-in user (matches the original —
 * getAllLeaveRequestsSafe() has no permission check there either);
 * creating is gated to "leave_create" (every role, by default) and
 * deciding to "leave_approve" (Admin/Manager by default) via the
 * Permission Matrix, same as every other approval-workflow module.
 *
 * Deferred vs. the original: notifying the employee's manager by
 * email on submission, and the employee by email on decision — no
 * email provider yet (see MIGRATION.md), recorded in the audit log
 * instead. Approval delegation (Security.gs's isDelegatedApprover,
 * driven by the "Delegate To" field) is now wired up — see
 * utils/delegation.js — so `canApprove` below also covers a
 * stand-in delegate, not just the Permission Matrix.
 *************************************************************/
const LeaveRequest = require("../models/LeaveRequest");
const { APPROVAL } = require("../models/ServiceRequest");
const { LEAVE_TYPE } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { isDelegatedApprover } = require("../utils/delegation");

async function listLeave(req, res) {
  const leaveRequests = await LeaveRequest.find().sort({ appliedDate: -1 }).lean();
  const canApprove = (await hasPermission(req.user.role, "leave_approve")) || (await isDelegatedApprover(req.user, "leave_approve"));

  res.render("leave/list", {
    leaveRequests,
    canApprove,
    LEAVE_TYPE,
    message: req.query.message || null,
  });
}

function showNewForm(req, res) {
  res.render("leave/new", { LEAVE_TYPE, error: null, form: {} });
}

async function createLeaveRequest(req, res) {
  try {
    const data = req.body;
    if (!data.employee) throw new Error("Employee is required.");
    if (!data.leaveType) throw new Error("Leave Type is required.");
    if (!data.fromDate) throw new Error("From Date is required.");
    if (!data.toDate) throw new Error("To Date is required.");

    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);
    if (to < from) throw new Error("To Date cannot be before From Date.");

    const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveId = await generateSequentialId(LeaveRequest.PREFIX);
    const leave = await LeaveRequest.create({
      leaveId,
      employee: data.employee,
      leaveType: data.leaveType,
      fromDate: data.fromDate,
      toDate: data.toDate,
      days,
      reason: data.reason || "",
      delegateTo: data.delegateTo || "",
      createdBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Leave",
      entityId: leave._id,
      details: `${data.employee} — ${days} day(s)`,
    });

    res.redirect("/leave?message=Leave Request Submitted Successfully");
  } catch (err) {
    res.status(400).render("leave/new", { LEAVE_TYPE, error: err.message, form: req.body });
  }
}

async function decideLeave(req, res) {
  try {
    const { decision } = req.body;
    if (decision !== APPROVAL.APPROVED && decision !== APPROVAL.REJECTED) throw new Error("Invalid decision.");

    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).render("errors/404");

    leave.status = decision;
    leave.approver = req.user.email;
    await leave.save();

    await logAudit({ user: req.user._id, action: "Decision", entityType: "Leave", entityId: leave._id, details: decision });

    res.redirect("/leave?message=" + encodeURIComponent(`Leave ${decision}.`));
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function bulkDecideLeave(req, res) {
  const ids = [].concat(req.body.ids || []);
  const decision = req.body.decision;
  if (decision !== APPROVAL.APPROVED && decision !== APPROVAL.REJECTED) return res.status(400).send("Invalid decision.");

  const result = await LeaveRequest.updateMany(
    { _id: { $in: ids }, status: APPROVAL.PENDING },
    { $set: { status: decision, approver: req.user.email } }
  );

  await logAudit({
    user: req.user._id,
    action: "Bulk Decision",
    entityType: "Leave",
    details: `${result.modifiedCount} of ${ids.length} leave request(s) ${decision.toLowerCase()}.`,
  });

  res.redirect("/leave?message=" + encodeURIComponent(`${result.modifiedCount} of ${ids.length} leave request(s) ${decision.toLowerCase()}.`));
}

module.exports = { listLeave, showNewForm, createLeaveRequest, decideLeave, bulkDecideLeave };
