/*************************************************************
 * materialRequestController.js — Phase 10 addition. Any department
 * requests a Stock item; Store issues it, which genuinely moves stock
 * via stockController.recordTransactionInternal() (a real
 * StockTransaction OUT), not just a status flag — see
 * models/MaterialRequest.js.
 *************************************************************/
const MaterialRequest = require("../models/MaterialRequest");
const { MATERIAL_REQUEST_STATUS } = MaterialRequest;
const StockItem = require("../models/StockItem");
const { recordTransactionInternal } = require("./stockController");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");

async function listMaterialRequests(req, res) {
  const requests = await MaterialRequest.find().sort({ requestedDate: -1 }).lean();
  const canIssue = await hasPermission(req.user.role, "material_requests_issue");

  res.render("material-requests/list", { requests, canIssue, MATERIAL_REQUEST_STATUS, message: req.query.message || null });
}

async function showNewForm(req, res) {
  const items = await StockItem.find({ status: "Active" }).sort({ itemName: 1 }).lean();
  res.render("material-requests/new", { error: null, form: {}, items });
}

async function submitRequest(req, res) {
  try {
    const data = req.body;
    if (!data.itemName) throw new Error("Item is required.");
    if (!data.quantity) throw new Error("Quantity is required.");

    const materialRequestId = await generateSequentialId("MREQ");
    await MaterialRequest.create({
      materialRequestId,
      requestedBy: req.user.name,
      department: data.department || req.user.department || "",
      itemName: data.itemName,
      quantity: data.quantity,
      purpose: data.purpose || "",
    });

    await logAudit({ user: req.user._id, action: "Submit", entityType: "Material Request", details: `${data.itemName} x${data.quantity}` });

    res.redirect(`/material-requests?message=${encodeURIComponent("Material Request Submitted")}`);
  } catch (err) {
    const items = await StockItem.find({ status: "Active" }).sort({ itemName: 1 }).lean();
    res.status(400).render("material-requests/new", { error: err.message, form: req.body, items });
  }
}

async function issueRequest(req, res) {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).render("errors/404");
    if (request.status !== MATERIAL_REQUEST_STATUS.PENDING) throw new Error("This request has already been decided.");

    // The real side effect — actually moves stock, and fails loudly
    // (not enough on hand, item renamed/removed) the same way a
    // direct Stock OUT transaction would, before the request is
    // marked Issued.
    await recordTransactionInternal({
      itemName: request.itemName,
      type: "OUT",
      quantity: request.quantity,
      reason: `Material Request ${request.materialRequestId} — ${request.requestedBy}`,
      performedByEmail: req.user.email,
      actorId: req.user._id,
    });

    request.status = MATERIAL_REQUEST_STATUS.ISSUED;
    request.issuedBy = req.user.name;
    request.issuedDate = new Date();
    await request.save();

    await logAudit({ user: req.user._id, action: "Issue", entityType: "Material Request", entityId: request._id, details: `${request.itemName} x${request.quantity}` });

    res.redirect(`/material-requests?message=${encodeURIComponent("Material Request Issued — stock updated.")}`);
  } catch (err) {
    res.redirect(`/material-requests?message=${encodeURIComponent(err.message)}`);
  }
}

async function rejectRequest(req, res) {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).render("errors/404");
    if (request.status !== MATERIAL_REQUEST_STATUS.PENDING) throw new Error("This request has already been decided.");

    request.status = MATERIAL_REQUEST_STATUS.REJECTED;
    request.rejectionReason = req.body.rejectionReason || "";
    await request.save();

    await logAudit({ user: req.user._id, action: "Reject", entityType: "Material Request", entityId: request._id });

    res.redirect(`/material-requests?message=${encodeURIComponent("Material Request Rejected.")}`);
  } catch (err) {
    res.redirect(`/material-requests?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { listMaterialRequests, showNewForm, submitRequest, issueRequest, rejectRequest };
