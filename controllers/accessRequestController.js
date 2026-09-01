/*************************************************************
 * accessRequestController.js — port of AccessRequestEngine.gs.
 *
 * A dedicated workflow for password resets and system/application
 * access requests — separate from general Service Requests, since
 * these have a distinct approval need (usually IT security, not a
 * generic catalog item) and benefit from being tracked as their own
 * category. Submission is open to anyone signed in (access_requests_submit
 * in permissions.js — the "anyone logged in" tier, same idea as
 * resignation_submit); listing/managing is IT-team gated, matching
 * requireITTeam() in the original.
 *************************************************************/
const AccessRequest = require("../models/AccessRequest");
const { ACCESS_REQUEST_TYPE, ACCESS_REQUEST_STATUS } = AccessRequest;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

function showNewForm(req, res) {
  res.render("access-requests/new", { error: null, form: {}, ACCESS_REQUEST_TYPE });
}

async function submitAccessRequest(req, res) {
  try {
    const data = req.body;
    if (!data.system) throw new Error("System/Application is required.");
    if (!Object.values(ACCESS_REQUEST_TYPE).includes(data.accessType)) throw new Error("Invalid access type.");

    const requestId = await generateSequentialId("ACC");
    await AccessRequest.create({
      requestId,
      employee: req.user.name,
      system: data.system,
      accessType: data.accessType,
      justification: data.justification || "",
    });

    await logAudit({
      user: req.user._id,
      action: "Submit",
      entityType: "Access Request",
      details: `${req.user.name} — ${data.accessType} for ${data.system}`,
    });

    res.redirect("/access-requests/mine?message=Access Request Submitted Successfully");
  } catch (err) {
    res.status(400).render("access-requests/new", { error: err.message, form: req.body, ACCESS_REQUEST_TYPE });
  }
}

/** Self-service — my access requests, no special permission beyond being logged in. */
async function myAccessRequests(req, res) {
  const requests = await AccessRequest.find({ employee: req.user.name }).sort({ requestedDate: -1 }).lean();
  res.render("access-requests/mine", { requests, message: req.query.message || null });
}

async function listAccessRequests(req, res) {
  const requests = await AccessRequest.find().sort({ requestedDate: -1 }).lean();
  res.render("access-requests/list", { requests, ACCESS_REQUEST_STATUS, message: req.query.message || null });
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!Object.values(ACCESS_REQUEST_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const request = await AccessRequest.findById(req.params.id);
    if (!request) return res.status(404).render("errors/404");

    request.status = status;
    request.approver = req.user.email;
    if (status === ACCESS_REQUEST_STATUS.COMPLETED) request.completedDate = new Date();
    await request.save();

    await logAudit({
      user: req.user._id,
      action: "Status Update",
      entityType: "Access Request",
      entityId: request._id,
      details: status,
    });

    res.redirect(`/access-requests?message=${encodeURIComponent(`Access request status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { showNewForm, submitAccessRequest, myAccessRequests, listAccessRequests, updateStatus };
