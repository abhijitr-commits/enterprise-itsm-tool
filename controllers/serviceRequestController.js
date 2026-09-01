/*************************************************************
 * serviceRequestController.js — port of ServiceRequestEngine.gs.
 * Approval workflow (decide/bulkDecide) mirrors the original;
 * email notifications (notifyUser) are not yet wired up — see
 * MIGRATION.md's EmailEngine note — so approval/decision events
 * are recorded in history + the audit log instead, same pattern
 * incidentController.js used for engineer reassignment.
 *************************************************************/
const ServiceRequest = require("../models/ServiceRequest");
const { STATUS } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

const { APPROVAL } = ServiceRequest;

async function listRequests(req, res) {
  const { q, approvalStatus, fulfillmentStatus } = req.query;

  const filter = {};
  if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (fulfillmentStatus) filter.fulfillmentStatus = fulfillmentStatus;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["requestId", "requester", "department", "catalogItem", "details"].map((f) => ({ [f]: rx }));
  }

  const requests = await ServiceRequest.find(filter).sort({ createdDate: -1 }).lean();

  res.render("requests/list", {
    requests,
    query: { q: q || "", approvalStatus: approvalStatus || "", fulfillmentStatus: fulfillmentStatus || "" },
    STATUS,
    APPROVAL,
  });
}

function showNewForm(req, res) {
  res.render("requests/new", { error: null, form: {} });
}

async function createRequest(req, res) {
  try {
    const data = req.body;
    for (const field of ["requester", "department", "catalogItem", "details"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const requestId = await generateSequentialId("REQ");

    const request = await ServiceRequest.create({
      requestId,
      requester: data.requester,
      department: data.department,
      catalogItem: data.catalogItem,
      details: data.details,
      approvalStatus: APPROVAL.PENDING,
      fulfillmentStatus: STATUS.OPEN,
      createdBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Service Request",
      entityId: request._id,
      details: data.catalogItem,
    });

    res.redirect(`/requests/${request._id}?created=1`);
  } catch (err) {
    res.status(400).render("requests/new", { error: err.message, form: req.body });
  }
}

async function showRequest(req, res) {
  const request = await ServiceRequest.findById(req.params.id).lean();
  if (!request) return res.status(404).render("errors/404");

  res.render("requests/detail", {
    request,
    STATUS,
    APPROVAL,
    justCreated: req.query.created === "1",
  });
}

async function updateRequest(req, res) {
  try {
    const data = req.body;
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).render("errors/404");

    request.requester = data.requester;
    request.department = data.department;
    request.catalogItem = data.catalogItem;
    request.details = data.details;
    request.fulfillmentStatus = data.fulfillmentStatus || STATUS.OPEN;

    if (request.fulfillmentStatus === STATUS.CLOSED && !request.closedDate) {
      request.closedDate = new Date();
    }

    await request.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Service Request",
      entityId: request._id,
      details: `Fulfillment: ${request.fulfillmentStatus}`,
    });

    res.redirect(`/requests/${request._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function decideRequest(req, res) {
  const { decision } = req.body;
  if (decision !== APPROVAL.APPROVED && decision !== APPROVAL.REJECTED) {
    return res.status(400).send("Invalid decision.");
  }

  const request = await ServiceRequest.findById(req.params.id);
  if (!request) return res.status(404).render("errors/404");

  request.approver = req.user.email;
  request.approvalStatus = decision;
  request.history.push({ field: "approvalStatus", oldValue: APPROVAL.PENDING, newValue: decision, changedBy: req.user._id });

  if (decision === APPROVAL.REJECTED) {
    request.fulfillmentStatus = STATUS.CLOSED;
    request.closedDate = new Date();
  }

  await request.save();

  await logAudit({
    user: req.user._id,
    action: "Decision",
    entityType: "Service Request",
    entityId: request._id,
    details: decision,
  });

  res.redirect(`/requests/${request._id}`);
}

async function bulkDecideRequests(req, res) {
  const ids = [].concat(req.body.ids || []);
  const { decision } = req.body;
  if (decision !== APPROVAL.APPROVED && decision !== APPROVAL.REJECTED) {
    return res.status(400).send("Invalid decision.");
  }

  const update = { approver: req.user.email, approvalStatus: decision };
  if (decision === APPROVAL.REJECTED) {
    update.fulfillmentStatus = STATUS.CLOSED;
    update.closedDate = new Date();
  }

  const result = await ServiceRequest.updateMany(
    { _id: { $in: ids }, approvalStatus: APPROVAL.PENDING },
    { $set: update }
  );

  await logAudit({
    user: req.user._id,
    action: "Bulk Decision",
    entityType: "Service Request",
    details: `${result.modifiedCount} of ${ids.length} request(s) ${decision.toLowerCase()}.`,
  });

  res.redirect("/requests");
}

async function closeRequest(req, res) {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) return res.status(404).render("errors/404");

  request.fulfillmentStatus = STATUS.CLOSED;
  request.closedDate = new Date();
  await request.save();

  await logAudit({
    user: req.user._id,
    action: "Close",
    entityType: "Service Request",
    entityId: request._id,
  });

  res.redirect(`/requests/${request._id}`);
}

async function addComment(req, res) {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) return res.status(404).render("errors/404");

  request.comments.push({
    author: req.user._id,
    text: req.body.text,
    isInternal: req.body.isInternal === "on",
  });
  await request.save();

  res.redirect(`/requests/${request._id}`);
}

module.exports = {
  listRequests,
  showNewForm,
  createRequest,
  showRequest,
  updateRequest,
  decideRequest,
  bulkDecideRequests,
  closeRequest,
  addComment,
};
