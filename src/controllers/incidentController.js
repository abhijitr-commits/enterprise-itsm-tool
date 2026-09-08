/*************************************************************
 * incidentController.js — port of IncidentEngine.gs.
 * Route-level requirePermission() middleware replaces the
 * in-function requirePermission() calls from Apps Script;
 * everything else (SLA calc, audit logging, notifications,
 * validation) mirrors the original function-for-function.
 *************************************************************/
const Incident = require("../models/Incident");
const Asset = require("../models/Asset");
const Category = require("../models/Category");
const { STATUS, PRIORITY } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { calculateSLADue } = require("../utils/sla");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");
const { notifyUser } = require("../utils/notifications");
const { paginate } = require("../utils/pagination");
const { applyAutomation, recordAutomationRun } = require("../utils/automationEngine");

/**
 * Phase 9 helper — a light "Asset Name (Asset ID)" list for the
 * optional Related Asset field's <datalist>, so filing an incident
 * against a specific robot unit doesn't require memorizing its exact
 * Asset ID. Not gated on any permission (same as the rest of the
 * Incident form) — just a convenience list, matching against Asset
 * happens by plain string, same as everywhere else in this app.
 */
async function listAssetNames() {
  const assets = await Asset.find({ status: { $ne: "Decommissioned" } }).select("assetId assetName").sort({ assetName: 1 }).lean();
  return assets.map((a) => `${a.assetName} (${a.assetId})`);
}

// Master Data -> Categories has an "Incident" module column purpose-built
// for this field, so the Category field offers real suggestions instead
// of every reporter re-typing "Hardware"/"Network"/etc. their own way —
// still a <datalist>, not a hard <select>, since an edge-case incident
// category an Admin hasn't added yet shouldn't be un-reportable.
async function listIncidentCategoryNames() {
  const categories = await Category.find({ module: "Incident" }).select("name").sort({ name: 1 }).lean();
  return categories.map((c) => c.name);
}

async function listIncidents(req, res) {
  const { q, status, priority } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (q) {
    // Port of searchIncidents(): case-insensitive match across the same fields.
    const rx = new RegExp(q, "i");
    filter.$or = [
      "incidentId",
      "employeeName",
      "department",
      "location",
      "category",
      "priority",
      "subject",
      "status",
      "engineer",
    ].map((field) => ({ [field]: rx }));
  }

  const { rows: incidents, pageInfo } = await paginate(Incident, filter, { createdDate: -1 }, req.query);

  res.render("incidents/list", {
    incidents,
    query: { q: q || "", status: status || "", priority: priority || "" },
    STATUS,
    PRIORITY,
    pageInfo,
  });
}

async function showNewForm(req, res) {
  const [assetNames, categories] = await Promise.all([listAssetNames(), listIncidentCategoryNames()]);
  res.render("incidents/new", { PRIORITY, error: null, form: {}, assetNames, categories });
}

async function createIncident(req, res) {
  try {
    const data = req.body;

    for (const field of ["employeeName", "department", "location", "category", "priority", "subject", "description"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const incidentId = await generateSequentialId("INC");
    const createdDate = new Date();

    const incident = new Incident({
      incidentId,
      createdDate,
      employeeName: data.employeeName,
      department: data.department,
      location: data.location,
      category: data.category,
      priority: data.priority,
      subject: data.subject,
      description: data.description,
      status: STATUS.OPEN,
      remarks: data.remarks || "",
      relatedAsset: data.relatedAsset || "",
      createdBy: req.user.email,
    });

    // Automation engine (see utils/automationEngine.js) runs before the SLA
    // due date is calculated, so an escalatePriority action is reflected in
    // the SLA clock, not just the priority label.
    const automationResult = await applyAutomation({ moduleName: "Incident", trigger: "onCreate", doc: incident });

    incident.slaDue = await calculateSLADue("Incident", createdDate, incident.priority);

    await incident.save();

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Incident",
      entityId: incident._id,
      details: data.subject,
    });

    await recordAutomationRun(automationResult, { entityType: "Incident", entityId: incident._id, userId: req.user._id });

    res.redirect(`/incidents/${incident._id}?created=1`);
  } catch (err) {
    const [assetNames, categories] = await Promise.all([listAssetNames(), listIncidentCategoryNames()]);
    res.status(400).render("incidents/new", { PRIORITY, error: err.message, form: req.body, assetNames, categories });
  }
}

async function showIncident(req, res) {
  const incident = await Incident.findById(req.params.id).lean();
  if (!incident) return res.status(404).render("errors/404");

  const [attachments, auditEntries, canUpload, assetNames, categories] = await Promise.all([
    getAttachmentsForRecord("incidents", incident._id),
    getAuditTrailForRecord(incident._id),
    hasPermission(req.user.role, "incidents_edit"),
    listAssetNames(),
    listIncidentCategoryNames(),
  ]);

  res.render("incidents/detail", {
    incident,
    STATUS,
    PRIORITY,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    moduleKey: "incidents",
    assetNames,
    categories,
  });
}

async function updateIncident(req, res) {
  try {
    const data = req.body;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).render("errors/404");

    const previousEngineer = incident.engineer;
    const previousStatus = incident.status;

    incident.employeeName = data.employeeName;
    incident.department = data.department;
    incident.location = data.location;
    incident.category = data.category;
    incident.priority = data.priority;
    incident.subject = data.subject;
    incident.description = data.description;
    incident.status = data.status || STATUS.OPEN;
    incident.engineer = data.engineer || "";
    incident.remarks = data.remarks || "";
    incident.relatedAsset = data.relatedAsset || "";

    if (incident.status === STATUS.CLOSED && !incident.closedDate) {
      incident.closedDate = new Date();
    }

    const automationResult = await applyAutomation({ moduleName: "Incident", trigger: "onUpdate", doc: incident });

    await incident.save();

    if (data.engineer && data.engineer !== previousEngineer) {
      incident.history.push({
        field: "engineer",
        oldValue: previousEngineer,
        newValue: data.engineer,
        changedBy: req.user._id,
      });
      await incident.save();

      // In-app bell notification for the newly assigned engineer. engineer
      // is a free-text display name (a spreadsheet-migration leftover, not
      // a User reference — see utils/notifications.js's resolveRecipient),
      // so this is a best-effort exact-name match: it silently finds no
      // one if the name doesn't match a User exactly or matches more than
      // one. Fire-and-forget — never let this delay or fail the redirect.
      notifyUser({
        name: data.engineer,
        message: `You were assigned to incident ${incident.incidentId} — ${incident.subject}`,
        link: `/incidents/${incident._id}`,
      });
    }

    // Architecture Phase 4 follow-up — "phase movement" notification: the
    // reporting employee hears about it the moment the incident's status
    // actually moves (In Progress, Resolved, Closed, etc.), not just when
    // an engineer gets assigned. employeeName is a free-text display name
    // (a spreadsheet-migration leftover, not a User reference — same
    // best-effort exact-name match as the engineer notification above),
    // so this silently finds no one if it doesn't match a real login,
    // same safe fallback resolveRecipient() always uses.
    if (incident.status !== previousStatus) {
      notifyUser({
        name: incident.employeeName,
        message: `Your incident ${incident.incidentId} — ${incident.subject} is now ${incident.status}.`,
        link: `/incidents/${incident._id}`,
      });
    }

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Incident",
      entityId: incident._id,
      details: `Status: ${incident.status}`,
    });

    await recordAutomationRun(automationResult, { entityType: "Incident", entityId: incident._id, userId: req.user._id });

    res.redirect(`/incidents/${incident._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function closeIncident(req, res) {
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).render("errors/404");

  incident.status = STATUS.CLOSED;
  incident.closedDate = new Date();
  await incident.save();

  await logAudit({
    user: req.user._id,
    action: "Close",
    entityType: "Incident",
    entityId: incident._id,
  });

  res.redirect(`/incidents/${incident._id}`);
}

async function deleteIncident(req, res) {
  const incident = await Incident.findByIdAndDelete(req.params.id);
  if (!incident) return res.status(404).render("errors/404");

  await logAudit({
    user: req.user._id,
    action: "Delete",
    entityType: "Incident",
    entityId: incident._id,
  });

  res.redirect("/incidents");
}

async function bulkCloseIncidents(req, res) {
  const ids = [].concat(req.body.ids || []);
  const result = await Incident.updateMany(
    { _id: { $in: ids }, status: { $ne: STATUS.CLOSED } },
    { $set: { status: STATUS.CLOSED, closedDate: new Date() } }
  );

  await logAudit({
    user: req.user._id,
    action: "Bulk Close",
    entityType: "Incident",
    details: `${result.modifiedCount} of ${ids.length} incident(s) closed.`,
  });

  res.redirect("/incidents");
}

async function addComment(req, res) {
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).render("errors/404");

  incident.comments.push({
    author: req.user._id,
    text: req.body.text,
    isInternal: req.body.isInternal === "on",
  });
  await incident.save();

  res.redirect(`/incidents/${incident._id}`);
}

module.exports = {
  listIncidents,
  showNewForm,
  createIncident,
  showIncident,
  updateIncident,
  closeIncident,
  deleteIncident,
  bulkCloseIncidents,
  addComment,
};
