/*************************************************************
 * safetyController.js — Phase 9 addition, modeled directly on
 * complaintController.js's shape (open list, "mine" list, submit,
 * manage/update-status), for physical safety incidents and near-
 * misses specific to a hardware/robotics workplace. See
 * models/SafetyIncident.js for why this is a separate module from
 * Complaints rather than just another complaint category.
 *************************************************************/
const SafetyIncident = require("../models/SafetyIncident");
const { SAFETY_SEVERITY, SAFETY_STATUS } = SafetyIncident;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { notifyChannels } = require("../utils/notifications");

async function listSafetyIncidents(req, res) {
  const incidents = await SafetyIncident.find().sort({ createdDate: -1 }).lean();
  const canManage = await hasPermission(req.user.role, "safety_manage");

  res.render("safety/list", { incidents, canManage, SAFETY_SEVERITY, SAFETY_STATUS, message: req.query.message || null });
}

async function mySafetyIncidents(req, res) {
  const incidents = await SafetyIncident.find({ reporter: req.user.name }).sort({ createdDate: -1 }).lean();
  res.render("safety/mine", { incidents, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("safety/new", { error: null, form: {}, SAFETY_SEVERITY });
}

async function submitSafetyIncident(req, res) {
  try {
    const data = req.body;
    if (!data.description) throw new Error("Description is required.");
    if (!Object.values(SAFETY_SEVERITY).includes(data.severity)) throw new Error("A valid severity is required.");

    const safetyIncidentId = await generateSequentialId("SAF");
    const incident = await SafetyIncident.create({
      safetyIncidentId,
      reporter: req.user.name,
      reporterEmail: req.user.email,
      department: data.department || req.user.department || "",
      location: data.location || "",
      severity: data.severity,
      injuryInvolved: data.injuryInvolved === "on",
      relatedAsset: data.relatedAsset || "",
      description: data.description,
      immediateActionTaken: data.immediateActionTaken || "",
    });

    await logAudit({ user: req.user._id, action: "Submit", entityType: "Safety Incident", entityId: incident._id, details: `${req.user.name} — ${data.severity}` });

    // Same "alert the team over the free webhook channel instead of
    // email" pattern as the public incident form (Phase 7) — no email
    // provider, but a safety event genuinely deserves an immediate
    // ping if one is configured; silently no-ops otherwise.
    notifyChannels(
      `Safety Report: ${incident.safetyIncidentId} (${incident.severity})`,
      `${incident.reporter} reported a ${incident.severity} safety incident${incident.injuryInvolved ? " — INJURY INVOLVED" : ""} at ${incident.location || "an unspecified location"}.\n${incident.description}`
    ).catch(() => {});

    res.redirect("/safety/mine?message=Safety Incident Reported. Thank you for speaking up.");
  } catch (err) {
    res.status(400).render("safety/new", { error: err.message, form: req.body, SAFETY_SEVERITY });
  }
}

async function updateStatus(req, res) {
  try {
    const { status, correctiveAction, assignedTo } = req.body;
    if (!Object.values(SAFETY_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const incident = await SafetyIncident.findById(req.params.id);
    if (!incident) return res.status(404).render("errors/404");

    incident.status = status;
    if (assignedTo !== undefined) incident.assignedTo = assignedTo;
    if (correctiveAction) incident.correctiveAction = correctiveAction;
    if (status === SAFETY_STATUS.CLOSED) incident.closedDate = new Date();
    await incident.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Safety Incident", entityId: incident._id, details: status });

    res.redirect(`/safety?message=${encodeURIComponent(`Safety Incident status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listSafetyIncidents, mySafetyIncidents, showNewForm, submitSafetyIncident, updateStatus };
