/*************************************************************
 * apiController.js — Architecture Phase 4 (see itsm_architecture_comparison.md):
 * the "Integration Hub" REST API — a small, honest Table-API-style
 * surface (create + read) for Incidents, Service Requests, Problems,
 * and Changes, the same four core ticket modules the automation engine
 * (Phase 1) already hooks into.
 *
 * Every write here runs through the EXACT SAME pipeline a browser-filed
 * ticket does — generateSequentialId, applyAutomation/recordAutomationRun,
 * logAudit — so an API-created Incident is indistinguishable from a
 * human-filed one anywhere else in the app (SLA due dates, automation
 * rules, reports, the audit trail all just work). The only difference is
 * `createdBy`, which is stamped as a synthetic integration address rather
 * than a real user's email, and `user: null` on the audit log entry
 * (AuditLog.user is optional — see models/AuditLog.js — precisely so
 * system/API-originated actions have somewhere honest to point instead of
 * a fake user id).
 *
 * Auth: every route here sits behind requireApiToken() (utils/apiAuth.js)
 * at the router level, not per-function — see routes/apiRoutes.js.
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Problem = require("../models/Problem");
const Change = require("../models/Change");
const { STATUS, PRIORITY, COMPANY_EMAIL_DOMAIN } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { calculateSLADue } = require("../utils/sla");
const { logAudit } = require("../utils/auditLog");
const { applyAutomation, recordAutomationRun } = require("../utils/automationEngine");

const { APPROVAL } = ServiceRequest;
const { IMPL } = Change;

const API_ACTOR_EMAIL = `integration-api@${COMPANY_EMAIL_DOMAIN}`;

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (!body[field]) return `${field} is required.`;
  }
  return null;
}

/************************************************
 * INCIDENTS — POST /api/v1/incidents, GET /api/v1/incidents,
 * GET /api/v1/incidents/:incidentId
 ************************************************/
async function createIncidentApi(req, res, next) {
  try {
    const data = req.body || {};
    const missing = requireFields(data, ["employeeName", "department", "location", "category", "priority", "subject", "description"]);
    if (missing) return badRequest(res, missing);
    if (!Object.values(PRIORITY).includes(data.priority)) {
      return badRequest(res, `priority must be one of: ${Object.values(PRIORITY).join(", ")}`);
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
      createdBy: API_ACTOR_EMAIL,
    });

    const automationResult = await applyAutomation({ moduleName: "Incident", trigger: "onCreate", doc: incident });
    incident.slaDue = await calculateSLADue("Incident", createdDate, incident.priority);

    await incident.save();

    await logAudit({
      user: null,
      action: "Create",
      entityType: "Incident",
      entityId: incident._id,
      details: `${data.subject} (via Integration API)`,
    });

    await recordAutomationRun(automationResult, { entityType: "Incident", entityId: incident._id, userId: null });

    res.status(201).json({ success: true, incident: { incidentId: incident.incidentId, id: incident._id, status: incident.status, priority: incident.priority, slaDue: incident.slaDue } });
  } catch (err) {
    next(err);
  }
}

async function getIncidentApi(req, res, next) {
  try {
    const incident = await Incident.findOne({ incidentId: req.params.incidentId }).lean();
    if (!incident) return res.status(404).json({ success: false, message: "No incident with that incidentId." });
    res.json({ success: true, incident });
  } catch (err) {
    next(err);
  }
}

async function listIncidentsApi(req, res, next) {
  try {
    const { status, priority, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const cap = Math.min(parseInt(limit, 10) || 50, 200);
    const incidents = await Incident.find(filter).sort({ createdDate: -1 }).limit(cap).lean();
    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    next(err);
  }
}

/************************************************
 * SERVICE REQUESTS — POST /api/v1/requests
 ************************************************/
async function createServiceRequestApi(req, res, next) {
  try {
    const data = req.body || {};
    const missing = requireFields(data, ["requester", "department", "catalogItem", "details"]);
    if (missing) return badRequest(res, missing);

    const requestId = await generateSequentialId("REQ");

    const request = new ServiceRequest({
      requestId,
      requester: data.requester,
      department: data.department,
      catalogItem: data.catalogItem,
      details: data.details,
      approvalStatus: APPROVAL.PENDING,
      fulfillmentStatus: STATUS.OPEN,
      createdBy: API_ACTOR_EMAIL,
    });

    const automationResult = await applyAutomation({ moduleName: "ServiceRequest", trigger: "onCreate", doc: request });
    await request.save();

    await logAudit({
      user: null,
      action: "Create",
      entityType: "Service Request",
      entityId: request._id,
      details: `${data.catalogItem} (via Integration API)`,
    });

    await recordAutomationRun(automationResult, { entityType: "ServiceRequest", entityId: request._id, userId: null });

    res.status(201).json({ success: true, request: { requestId: request.requestId, id: request._id, approvalStatus: request.approvalStatus, fulfillmentStatus: request.fulfillmentStatus } });
  } catch (err) {
    next(err);
  }
}

/************************************************
 * PROBLEMS — POST /api/v1/problems
 ************************************************/
async function createProblemApi(req, res, next) {
  try {
    const data = req.body || {};
    const missing = requireFields(data, ["title", "description"]);
    if (missing) return badRequest(res, missing);

    const problemId = await generateSequentialId("PRB");

    const problem = new Problem({
      problemId,
      title: data.title,
      description: data.description,
      linkedIncidents: data.linkedIncidents || "",
      rootCause: "",
      knownError: "No",
      status: STATUS.OPEN,
      owner: data.owner || "",
      createdBy: API_ACTOR_EMAIL,
    });

    const automationResult = await applyAutomation({ moduleName: "Problem", trigger: "onCreate", doc: problem });
    await problem.save();

    await logAudit({
      user: null,
      action: "Create",
      entityType: "Problem",
      entityId: problem._id,
      details: `${data.title} (via Integration API)`,
    });

    await recordAutomationRun(automationResult, { entityType: "Problem", entityId: problem._id, userId: null });

    res.status(201).json({ success: true, problem: { problemId: problem.problemId, id: problem._id, status: problem.status } });
  } catch (err) {
    next(err);
  }
}

/************************************************
 * CHANGES — POST /api/v1/changes
 ************************************************/
async function createChangeApi(req, res, next) {
  try {
    const data = req.body || {};
    const missing = requireFields(data, ["title", "description", "riskLevel", "plannedDate", "requestedBy", "department"]);
    if (missing) return badRequest(res, missing);

    const plannedDate = new Date(data.plannedDate);
    if (isNaN(plannedDate.getTime())) return badRequest(res, "plannedDate must be a valid date.");

    const changeId = await generateSequentialId("CHG");

    const change = new Change({
      changeId,
      title: data.title,
      description: data.description,
      riskLevel: data.riskLevel,
      cabStatus: APPROVAL.PENDING,
      plannedDate,
      implementationStatus: IMPL.NOT_STARTED,
      requestedBy: data.requestedBy,
      department: data.department,
      createdBy: API_ACTOR_EMAIL,
    });

    const automationResult = await applyAutomation({ moduleName: "Change", trigger: "onCreate", doc: change });
    await change.save();

    await logAudit({
      user: null,
      action: "Create",
      entityType: "Change",
      entityId: change._id,
      details: `${data.title} (via Integration API)`,
    });

    await recordAutomationRun(automationResult, { entityType: "Change", entityId: change._id, userId: null });

    res.status(201).json({ success: true, change: { changeId: change.changeId, id: change._id, cabStatus: change.cabStatus, implementationStatus: change.implementationStatus } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createIncidentApi,
  getIncidentApi,
  listIncidentsApi,
  createServiceRequestApi,
  createProblemApi,
  createChangeApi,
};
