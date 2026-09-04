/*************************************************************
 * complaintController.js — port of ComplaintEngine.gs.
 *
 * Generic complaint booking — deliberately NOT category-locked (unlike
 * Incident Management, which is IT-specific). Anyone can submit any
 * kind of complaint (facilities, behavior, HR, general grievance,
 * etc.). Reading the full list is open to any signed-in user (matches
 * the original — getAllComplaintsSafe() has no permission check
 * there either), same "canManage" flag pattern used by Leave/Requests
 * for who sees the status-update controls; creating is
 * "complaints_submit" (every role, by default) and deciding is
 * "complaints_manage" (Admin/Manager by default) via the Permission
 * Matrix.
 *
 * Deferred vs. the original: routing a notification to the
 * complainant's actual Department Head by email — no email provider
 * yet (see MIGRATION.md), recorded in the audit log instead.
 *************************************************************/
const Complaint = require("../models/Complaint");
const { COMPLAINT_STATUS } = Complaint;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");

async function listComplaints(req, res) {
  const complaints = await Complaint.find().sort({ createdDate: -1 }).lean();
  const canManage = await hasPermission(req.user.role, "complaints_manage");

  res.render("complaints/list", { complaints, canManage, COMPLAINT_STATUS, message: req.query.message || null });
}

async function myComplaints(req, res) {
  const complaints = await Complaint.find({ complainant: req.user.name }).sort({ createdDate: -1 }).lean();
  res.render("complaints/mine", { complaints, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("complaints/new", { error: null, form: {} });
}

async function submitComplaint(req, res) {
  try {
    const data = req.body;
    if (!data.subject) throw new Error("Subject is required.");
    if (!data.description) throw new Error("Description is required.");

    const complaintId = await generateSequentialId("COMP");
    await Complaint.create({
      complaintId,
      complainant: req.user.name,
      complainantEmail: req.user.email,
      department: data.department || req.user.department || "",
      category: data.category || "General",
      subject: data.subject,
      description: data.description,
    });

    await logAudit({ user: req.user._id, action: "Submit", entityType: "Complaint", details: `${req.user.name} — ${data.subject}` });

    res.redirect("/complaints/mine?message=Complaint Submitted Successfully");
  } catch (err) {
    res.status(400).render("complaints/new", { error: err.message, form: req.body });
  }
}

async function updateStatus(req, res) {
  try {
    const { status, resolutionNotes, assignedTo } = req.body;
    if (!Object.values(COMPLAINT_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).render("errors/404");

    complaint.status = status;
    if (assignedTo !== undefined) complaint.assignedTo = assignedTo;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    if (status === COMPLAINT_STATUS.RESOLVED || status === COMPLAINT_STATUS.CLOSED) complaint.resolvedDate = new Date();
    await complaint.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Complaint", entityId: complaint._id, details: status });

    res.redirect(`/complaints?message=${encodeURIComponent(`Complaint status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listComplaints, myComplaints, showNewForm, submitComplaint, updateStatus };
