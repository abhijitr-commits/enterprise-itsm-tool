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
const AdminAsset = require("../models/AdminAsset");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { positiveNumber } = require("../utils/validation");

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
      quantity: positiveNumber(data.quantity, 1, { min: 1 }),
      estimatedAmount: positiveNumber(data.estimatedAmount, 0, { min: 0 }),
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

/**
 * Marks an Approved purchase Received. Optionally — only when the
 * person checks "Add to Asset Register" on the Mark Received form,
 * since not every purchase is an asset (stationery, services, a
 * one-off consumable) — it also writes a real linked AdminAsset entry,
 * the same "record a real transaction, don't just flag a status" rule
 * adminScrapController.js's dispose() uses to write a real stock OUT.
 * Without this, a received laptop or printer would otherwise need a
 * second, fully separate manual "Add Asset" entry to show up anywhere.
 */
async function markReceived(req, res) {
  try {
    const purchase = await AdminPurchase.findOne({ poId: req.params.poId });
    if (!purchase) return res.status(404).render("errors/404");
    if (purchase.status !== ADMIN_PURCHASE_STATUS.APPROVED) throw new Error("Only an Approved request can be marked received.");

    const data = req.body;
    const wantsAsset = data.addToAssetRegister === "on" || data.addToAssetRegister === "true";
    if (wantsAsset && !data.assetLocation) throw new Error("Location is required to add this purchase to the Asset Register.");

    purchase.status = ADMIN_PURCHASE_STATUS.RECEIVED;
    purchase.receivedDate = new Date();
    purchase.referenceBillNo = data.referenceBillNo || "";
    purchase.actualAmount =
      data.actualAmount !== undefined && data.actualAmount !== ""
        ? positiveNumber(data.actualAmount, purchase.estimatedAmount, { min: 0 })
        : purchase.estimatedAmount;
    await purchase.save();

    let assetNote = "";
    if (wantsAsset) {
      const assetId = await generateSequentialId("ADAST");
      const asset = await AdminAsset.create({
        assetId,
        assetName: purchase.itemDescription,
        type: purchase.category || "General",
        location: data.assetLocation,
        vendor: purchase.vendor || "",
        purchaseDate: purchase.receivedDate,
        warrantyExpiry: data.assetWarrantyExpiry ? new Date(data.assetWarrantyExpiry) : undefined,
        remarks: `Auto-created on receipt of Purchase ${purchase.poId}.`,
        createdBy: req.user.email,
      });
      await logAudit({ user: req.user._id, action: "Create", entityType: "AdminAsset", entityId: asset._id, details: `${asset.assetName} (from ${purchase.poId})` });
      assetNote = ` Added to Asset Register as ${assetId}.`;
    }

    await logAudit({ user: req.user._id, action: "Receive", entityType: "AdminPurchase", entityId: purchase._id, details: purchase.itemDescription });

    res.redirect(`/admin/purchases?message=${encodeURIComponent(`${purchase.poId} marked received.${assetNote}`)}`);
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
