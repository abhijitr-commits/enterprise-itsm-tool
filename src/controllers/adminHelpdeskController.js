/*************************************************************
 * adminHelpdeskController.js — Administration-department facility
 * helpdesk. Field-for-field mirror of complaintController.js (the
 * org-wide generic Complaints module): any signed-in employee can
 * read the list and submit an entry; only the Admin team can update
 * status/assignment/resolution (canManage flag, same pattern
 * complaints/list.ejs uses) — pointed at the separate AdminComplaint
 * collection so this queue and the general Complaints module never
 * mix. See AdminComplaint.js.
 *************************************************************/
const AdminComplaint = require("../models/AdminComplaint");
const { ADMIN_COMPLAINT_STATUS } = AdminComplaint;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { isAdminTeam } = require("../utils/teamAccess");

async function listComplaints(req, res) {
  const complaints = await AdminComplaint.find().sort({ createdDate: -1 }).lean();
  const canManage = isAdminTeam(req.user);
  res.render("admin-helpdesk/list", { complaints, canManage, ADMIN_COMPLAINT_STATUS, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("admin-helpdesk/new", { error: null, form: {} });
}

async function submitComplaint(req, res) {
  try {
    const data = req.body;
    if (!data.subject) throw new Error("Subject is required.");
    if (!data.description) throw new Error("Description is required.");

    const complaintId = await generateSequentialId("ADCOMP");
    await AdminComplaint.create({
      complaintId,
      complainant: req.user.name,
      complainantEmail: req.user.email,
      department: data.department || req.user.department || "",
      category: data.category || "Facility",
      subject: data.subject,
      description: data.description,
    });

    await logAudit({ user: req.user._id, action: "Submit", entityType: "AdminComplaint", details: `${req.user.name} — ${data.subject}` });

    res.redirect(`/admin/helpdesk?message=${encodeURIComponent("Request Submitted Successfully")}`);
  } catch (err) {
    res.status(400).render("admin-helpdesk/new", { error: err.message, form: req.body });
  }
}

async function updateStatus(req, res) {
  try {
    const { status, resolutionNotes, assignedTo } = req.body;
    if (!Object.values(ADMIN_COMPLAINT_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const complaint = await AdminComplaint.findOne({ complaintId: req.params.complaintId });
    if (!complaint) return res.status(404).render("errors/404");

    complaint.status = status;
    if (assignedTo !== undefined) complaint.assignedTo = assignedTo;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    if (status === ADMIN_COMPLAINT_STATUS.RESOLVED || status === ADMIN_COMPLAINT_STATUS.CLOSED) complaint.resolvedDate = new Date();
    await complaint.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "AdminComplaint", entityId: complaint._id, details: status });

    res.redirect(`/admin/helpdesk?message=${encodeURIComponent(`Request status updated to ${status}.`)}`);
  } catch (err) {
    res.redirect(`/admin/helpdesk?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { listComplaints, showNewForm, submitComplaint, updateStatus };
