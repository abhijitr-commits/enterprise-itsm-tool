/*************************************************************
 * adminPurchaseController.js — Administration-department
 * Procurement register: request → approve → receive, the same
 * 3-stage shape as adminScrapController.js's Pending Approval →
 * Approved → Disposed, with a Cancelled escape hatch from either
 * open state and a Mark Paid step mirroring adminStockController.js's
 * markPaid() for Stock Orders.
 *************************************************************/
const AdminPurchase = require("../models/AdminPurchase");
const { ADMIN_PURCHASE_STATUS, PAYMENT_STATUS } = AdminPurchase;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listPurchases(req, res) {
  const purchases = await AdminPurchase.find().sort({ createdAt: -1 }).lean();
  res.render("admin-purchases/list", { purchases, ADMIN_PURCHASE_STATUS, PAYMENT_STATUS, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("admin-purchases/new", { error: null, form: {} });
}

async function createPurchase(req, res) {
  try {
    const data = req.body;
    if (!data.itemDescription) throw new Error("Item Description is required.");

    const poId = await generateSequentialId("ADPO");
    await AdminPurchase.create({
      poId,
      itemDescription: data.itemDescription,
      category: data.category || "General",
      quantity: Number(data.quantity) || 1,
      estimatedAmount: Number(data.estimatedAmount) || 0,
      vendor: data.vendor || "",
      remarks: data.remarks || "",
      raisedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "AdminPurchase", details: data.itemDescription });

    res.redirect(`/admin/purchases?message=${encodeURIComponent("Purchase Request Raised Successfully")}`);
  } catch (err) {
    res.status(400).render("admin-purchases/new", { error: err.message, form: req.body });
  }
}

async function approve(req, res) {
  try {
    const purchase = await AdminPurchase.findOne({ poId: req.params.poId });
    if (!purchase) return res.status(404).render("errors/404");
    if (purchase.status !== ADMIN_PURCHASE_STATUS.PENDING_APPROVAL) throw new Error("Only a Pending Approval request can be approved.");

    purchase.status = ADMIN_PURCHASE_STATUS.APPROVED;
    purchase.approvedBy = req.user.email;
    purchase.approvedDate = new Date();
    await purchase.save();

    await logAudit({ user: req.user._id, action: "Approve", entityType: "AdminPurchase", entityId: purchase._id, details: purchase.itemDescription });

    res.redirect(`/admin/purchases?message=${encodeURIComponent(`${purchase.poId} approved.`)}`);
  } catch (err) {
    res.redirect(`/admin/purchases?message=${encodeURIComponent(err.message)}`);
  }
}

async function markReceived(req, res) {
  try {
    const purchase = await AdminPurchase.findOne({ poId: req.params.poId });
    if (!purchase) return res.status(404).render("errors/404");
    if (purchase.status !== ADMIN_PURCHASE_STATUS.APPROVED) throw new Error("Only an Approved request can be marked received.");

    const data = req.body;
    purchase.status = ADMIN_PURCHASE_STATUS.RECEIVED;
    purchase.receivedDate = new Date();
    purchase.referenceBillNo = data.referenceBillNo || "";
    purchase.actualAmount = data.actualAmount !== undefined && data.actualAmount !== "" ? Number(data.actualAmount) : purchase.estimatedAmount;
    await purchase.save();

    await logAudit({ user: req.user._id, action: "Receive", entityType: "AdminPurchase", entityId: purchase._id, details: purchase.itemDescription });

    res.redirect(`/admin/purchases?message=${encodeURIComponent(`${purchase.poId} marked received.`)}`);
  } catch (err) {
    res.redirect(`/admin/purchases?message=${encodeURIComponent(err.message)}`);
  }
}

async function markPaid(req, res) {
  try {
    const purchase = await AdminPurchase.findOne({ poId: req.params.poId });
    if (!purchase) return res.status(404).render("errors/404");
    if (purchase.status !== ADMIN_PURCHASE_STATUS.RECEIVED) throw new Error("Only a Received purchase can be marked paid.");

    purchase.paymentStatus = PAYMENT_STATUS.PAID;
    purchase.paymentDate = new Date();
    await purchase.save();

    await logAudit({ user: req.user._id, action: "Mark Paid", entityType: "AdminPurchase", entityId: purchase._id, details: purchase.itemDescription });

    res.redirect(`/admin/purchases?message=${encodeURIComponent(`${purchase.poId} marked paid.`)}`);
  } catch (err) {
    res.redirect(`/admin/purchases?message=${encodeURIComponent(err.message)}`);
  }
}

async function cancel(req, res) {
  try {
    const purchase = await AdminPurchase.findOne({ poId: req.params.poId });
    if (!purchase) return res.status(404).render("errors/404");
    if (![ADMIN_PURCHASE_STATUS.PENDING_APPROVAL, ADMIN_PURCHASE_STATUS.APPROVED].includes(purchase.status)) {
      throw new Error("Only a Pending Approval or Approved request can be cancelled.");
    }

    purchase.status = ADMIN_PURCHASE_STATUS.CANCELLED;
    await purchase.save();

    await logAudit({ user: req.user._id, action: "Cancel", entityType: "AdminPurchase", entityId: purchase._id, details: purchase.itemDescription });

    res.redirect(`/admin/purchases?message=${encodeURIComponent(`${purchase.poId} cancelled.`)}`);
  } catch (err) {
    res.redirect(`/admin/purchases?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { listPurchases, showNewForm, createPurchase, approve, markReceived, markPaid, cancel };
