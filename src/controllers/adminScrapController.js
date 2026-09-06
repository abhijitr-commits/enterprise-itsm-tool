/*************************************************************
 * adminScrapController.js — Administration-department Scrap
 * Management: request → approve → dispose, the same 3-stage
 * lifecycle shape as this app's other approval-gated registers
 * (Purchase Order's Ordered → Received, Expense Claim's
 * Pending → Approved → Reimbursed).
 *
 * When a scrap entry references a real Stock Management item (by
 * Item Code) and is marked Disposed, it also writes a genuine
 * AdminStockTransaction OUT for the scrapped quantity — same
 * "record a real transaction, don't just flag a status" rule
 * adminStockController.js's markReceived() uses for goods receipt.
 *************************************************************/
const AdminScrapItem = require("../models/AdminScrapItem");
const { DISPOSAL_METHOD, SCRAP_STATUS } = AdminScrapItem;
const AdminStockItem = require("../models/AdminStockItem");
const AdminStockTransaction = require("../models/AdminStockTransaction");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listScrap(req, res) {
  const items = await AdminScrapItem.find().sort({ createdAt: -1 }).lean();
  res.render("admin-scrap/list", { items, DISPOSAL_METHOD, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("admin-scrap/new", { error: null, form: {} });
}

async function createScrap(req, res) {
  try {
    const data = req.body;
    if (!data.itemName) throw new Error("Item Name is required.");
    if (!data.reason) throw new Error("Reason is required.");

    const scrapId = await generateSequentialId("SCRAP");
    await AdminScrapItem.create({
      scrapId,
      itemCode: data.itemCode || "",
      itemName: data.itemName,
      category: data.category || "General",
      quantity: Number(data.quantity) || 1,
      unit: data.unit || "pcs",
      reason: data.reason,
      scrapDate: data.scrapDate ? new Date(data.scrapDate) : new Date(),
      remarks: data.remarks || "",
      raisedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "AdminScrap", details: data.itemName });

    res.redirect(`/admin/scrap?message=${encodeURIComponent("Scrap Entry Raised Successfully")}`);
  } catch (err) {
    res.status(400).render("admin-scrap/new", { error: err.message, form: req.body });
  }
}

async function approve(req, res) {
  try {
    const item = await AdminScrapItem.findOne({ scrapId: req.params.scrapId });
    if (!item) return res.status(404).render("errors/404");
    if (item.status !== SCRAP_STATUS.PENDING_APPROVAL) throw new Error("Only a Pending Approval entry can be approved.");

    item.status = SCRAP_STATUS.APPROVED;
    item.approvedBy = req.user.email;
    item.approvedDate = new Date();
    await item.save();

    await logAudit({ user: req.user._id, action: "Approve", entityType: "AdminScrap", entityId: item._id, details: item.itemName });

    res.redirect(`/admin/scrap?message=${encodeURIComponent(`${item.scrapId} approved.`)}`);
  } catch (err) {
    res.redirect(`/admin/scrap?message=${encodeURIComponent(err.message)}`);
  }
}

/**
 * Marks an Approved scrap entry Disposed. When itemCode matches a real
 * Stock Management item, this also records a real OUT transaction for
 * the scrapped quantity — so Closing Stock (PC) on that item actually
 * drops, the same way a Stock Order's receipt actually raises it.
 */
async function dispose(req, res) {
  try {
    const item = await AdminScrapItem.findOne({ scrapId: req.params.scrapId });
    if (!item) return res.status(404).render("errors/404");
    if (item.status !== SCRAP_STATUS.APPROVED) throw new Error("Only an Approved entry can be marked disposed.");

    const data = req.body;
    if (!Object.values(DISPOSAL_METHOD).includes(data.disposalMethod)) throw new Error("A valid Disposal Method is required.");

    item.status = SCRAP_STATUS.DISPOSED;
    item.disposalMethod = data.disposalMethod;
    item.valueRecovered = Number(data.valueRecovered) || 0;
    item.disposedDate = new Date();
    await item.save();

    let stockNote = "";
    if (item.itemCode) {
      const stockItem = await AdminStockItem.findOne({ itemCode: item.itemCode }).lean();
      if (stockItem) {
        const transactionId = await generateSequentialId("ASTKTX");
        await AdminStockTransaction.create({
          transactionId,
          itemId: stockItem.itemId,
          itemName: stockItem.itemName,
          type: "OUT",
          quantity: item.quantity,
          reason: `Scrapped — ${item.scrapId}`,
          performedBy: req.user.email,
        });
        stockNote = ` Stock item ${stockItem.itemCode || stockItem.itemId} reduced by ${item.quantity}.`;
      }
    }

    await logAudit({ user: req.user._id, action: "Dispose", entityType: "AdminScrap", entityId: item._id, details: `${item.itemName} — ${data.disposalMethod}` });

    res.redirect(`/admin/scrap?message=${encodeURIComponent(`${item.scrapId} marked disposed.${stockNote}`)}`);
  } catch (err) {
    res.redirect(`/admin/scrap?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { listScrap, showNewForm, createScrap, approve, dispose };
