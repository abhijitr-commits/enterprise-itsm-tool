/*************************************************************
 * serviceRequestController.js — port of ServiceRequestEngine.gs.
 * Approval workflow (decide/bulkDecide) mirrors the original;
 * decisions are recorded in history + the audit log, plus (as of the
 * in-app notification bell) an in-app notifyUser() to the requester,
 * resolved reliably via createdBy (the filer's real email address —
 * see utils/notifications.js). EMAIL notifications are still not
 * wired up — see MIGRATION.md's EmailEngine note, blocked pending an
 * SMTP app password.
 *************************************************************/
const ServiceRequest = require("../models/ServiceRequest");
const RequestCatalog = require("../models/RequestCatalog");
const { STATUS } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");
const { notifyUser } = require("../utils/notifications");

const { APPROVAL } = ServiceRequest;

// Records that `name` got used on a request just now: bumps requestCount
// on a matching (case-insensitive) entry, or auto-creates one if nothing
// matched yet — see RequestCatalog.js for why both paths stay open.
// Deliberately swallow-and-log any failure here: the catalog is a
// convenience on top of Service Requests, not a dependency of them, so a
// duplicate-key race or a transient DB hiccup on THIS write must never
// turn into a failed request submission.
async function recordCatalogUsage(name, userEmail) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return;
  const nameKey = trimmed.toLowerCase();
  try {
    const updated = await RequestCatalog.findOneAndUpdate(
      { nameKey },
      { $inc: { requestCount: 1 } },
      { new: true }
    );
    if (!updated) {
      await RequestCatalog.create({
        name: trimmed,
        nameKey,
        source: "auto",
        requestCount: 1,
        createdBy: userEmail,
      });
    }
  } catch (err) {
    // Most likely a duplicate-key race (two people submitting the same
    // brand-new catalog item at the same instant) — harmless, the other
    // request's write already created the entry.
    console.error("[requestCatalog] recordCatalogUsage failed (non-fatal):", err.message);
  }
}

async function listRequests(req, res) {
  const { q, approvalStatus, fulfillmentStatus } = req.query;

  const filter = {};
  if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (fulfillmentStatus) filter.fulfillmentStatus = fulfillmentStatus;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["requestId", "requester", "department", "catalogItem", "details"].map((f) => ({ [f]: rx }));
  }

  const [requests, canManageCatalog] = await Promise.all([
    ServiceRequest.find(filter).sort({ createdDate: -1 }).lean(),
    hasPermission(req.user.role, "requests_catalog_manage"),
  ]);

  res.render("requests/list", {
    requests,
    query: { q: q || "", approvalStatus: approvalStatus || "", fulfillmentStatus: fulfillmentStatus || "" },
    STATUS,
    APPROVAL,
    canManageCatalog,
  });
}

async function showNewForm(req, res) {
  const catalogItems = await RequestCatalog.find({ active: true }).sort({ name: 1 }).select("name").lean();
  res.render("requests/new", { error: null, form: {}, catalogItems: catalogItems.map((c) => c.name) });
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

    // Non-blocking: grow/track the catalog, but never let this delay or
    // fail the redirect the person filing the request is waiting on.
    recordCatalogUsage(data.catalogItem, req.user.email);

    res.redirect(`/requests/${request._id}?created=1`);
  } catch (err) {
    res.status(400).render("requests/new", { error: err.message, form: req.body });
  }
}

async function showRequest(req, res) {
  const request = await ServiceRequest.findById(req.params.id).lean();
  if (!request) return res.status(404).render("errors/404");

  const [attachments, auditEntries, canUpload] = await Promise.all([
    getAttachmentsForRecord("requests", request._id),
    getAuditTrailForRecord(request._id),
    hasPermission(req.user.role, "requests_edit"),
  ]);

  res.render("requests/detail", {
    request,
    STATUS,
    APPROVAL,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    moduleKey: "requests",
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

  // In-app bell notification to the requester. createdBy is a reliable
  // real email address (unlike the free-text `requester` field), so this
  // resolves cleanly — fire-and-forget, never blocks the redirect.
  notifyUser({
    email: request.createdBy,
    message: `Your request ${request.requestId} (${request.catalogItem}) was ${decision.toLowerCase()}.`,
    link: `/requests/${request._id}`,
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

  // Fetched before the update so the bulk-decision notifications below know
  // which requests were actually still PENDING (the same filter the update
  // itself uses) and have their requestId/catalogItem/createdBy to hand.
  const affected = await ServiceRequest.find({ _id: { $in: ids }, approvalStatus: APPROVAL.PENDING })
    .select("_id requestId catalogItem createdBy")
    .lean();

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

  // Same in-app notification as the single-request decision path, once
  // per affected request — fire-and-forget, never blocks the redirect.
  affected.forEach((r) => {
    notifyUser({
      email: r.createdBy,
      message: `Your request ${r.requestId} (${r.catalogItem}) was ${decision.toLowerCase()}.`,
      link: `/requests/${r._id}`,
    });
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

/************************************************
 * REQUEST CATALOG MANAGEMENT — /requests/catalog. Gated by
 * requests_catalog_manage (see permissions.js) rather than
 * requests_edit, since curating the picklist is a level above
 * editing an individual request. See RequestCatalog.js for how
 * entries get here in the first place (manual add here, or
 * auto-add from serviceRequestController.js's createRequest).
 ************************************************/
async function listCatalog(req, res) {
  const entries = await RequestCatalog.find().sort({ name: 1 }).lean();
  res.render("requests/catalog", {
    entries,
    message: req.query.message || null,
    error: null,
    form: {},
  });
}

async function createCatalogEntry(req, res) {
  try {
    const data = req.body;
    const name = String(data.name || "").trim();
    if (!name) throw new Error("Name is required.");
    const nameKey = name.toLowerCase();

    const existing = await RequestCatalog.findOne({ nameKey });
    if (existing) throw new Error(`"${existing.name}" is already in the catalog.`);

    await RequestCatalog.create({
      name,
      nameKey,
      category: (data.category || "").trim(),
      description: (data.description || "").trim(),
      source: "manual",
      createdBy: req.user.email,
    });

    res.redirect(`/requests/catalog?message=${encodeURIComponent(`"${name}" added to the catalog.`)}`);
  } catch (err) {
    const entries = await RequestCatalog.find().sort({ name: 1 }).lean();
    res.status(400).render("requests/catalog", { entries, message: null, error: err.message, form: req.body });
  }
}

async function updateCatalogEntry(req, res) {
  try {
    const entry = await RequestCatalog.findById(req.params.id);
    if (!entry) return res.status(404).render("errors/404");

    const data = req.body;
    if (data.name !== undefined) {
      const name = String(data.name || "").trim();
      if (!name) throw new Error("Name cannot be empty.");
      const nameKey = name.toLowerCase();
      if (nameKey !== entry.nameKey) {
        const clash = await RequestCatalog.findOne({ nameKey, _id: { $ne: entry._id } });
        if (clash) throw new Error(`"${clash.name}" is already in the catalog.`);
      }
      entry.name = name;
      entry.nameKey = nameKey;
    }
    if (data.category !== undefined) entry.category = String(data.category).trim();
    if (data.description !== undefined) entry.description = String(data.description).trim();
    entry.active = data.active === "on" || data.active === "true";

    await entry.save();

    res.redirect(`/requests/catalog?message=${encodeURIComponent(`"${entry.name}" updated.`)}`);
  } catch (err) {
    const entries = await RequestCatalog.find().sort({ name: 1 }).lean();
    res.status(400).render("requests/catalog", { entries, message: null, error: err.message, form: {} });
  }
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
  listCatalog,
  createCatalogEntry,
  updateCatalogEntry,
};
