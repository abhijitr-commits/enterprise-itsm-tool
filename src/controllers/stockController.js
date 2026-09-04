/*************************************************************
 * stockController.js — port of StockEngine.gs.
 *
 * Current stock is never stored as a single editable number (that
 * drifts out of sync fast). Instead, every stock movement is logged as
 * a transaction (IN or OUT), and current stock is always CALCULATED
 * as Opening Stock + all IN - all OUT — see withCurrentStock() below.
 *************************************************************/
const StockItem = require("../models/StockItem");
const StockTransaction = require("../models/StockTransaction");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

/** Port of getAllStockItemsSafe()'s derivation step — pulls all transactions once, then sums per item, far faster than querying per item. */
async function withCurrentStock(items) {
  const transactions = await StockTransaction.find({ itemId: { $in: items.map((i) => i.itemId) } }).lean();

  const inTotals = {};
  const outTotals = {};
  transactions.forEach((t) => {
    if (t.type === "IN") inTotals[t.itemId] = (inTotals[t.itemId] || 0) + t.quantity;
    else if (t.type === "OUT") outTotals[t.itemId] = (outTotals[t.itemId] || 0) + t.quantity;
  });

  return items.map((item) => {
    const currentStock = item.openingStock + (inTotals[item.itemId] || 0) - (outTotals[item.itemId] || 0);
    return { ...item, currentStock, lowStock: currentStock <= item.reorderLevel };
  });
}

async function listStock(req, res) {
  const items = await StockItem.find().sort({ itemName: 1 }).lean();
  let withStock = await withCurrentStock(items);

  const lowStockOnly = req.query.lowStock === "1";
  if (lowStockOnly) withStock = withStock.filter((i) => i.lowStock);

  res.render("stock/list", {
    items: withStock,
    lowStockOnly,
    message: req.query.message || null,
  });
}

function showNewForm(req, res) {
  res.render("stock/new", { error: null, form: {} });
}

async function createItem(req, res) {
  try {
    const data = req.body;
    if (!data.itemName) throw new Error("Item Name is required.");

    const itemId = await generateSequentialId("STK");
    await StockItem.create({
      itemId,
      itemName: data.itemName,
      category: data.category || "General",
      unit: data.unit || "pcs",
      openingStock: Number(data.openingStock) || 0,
      reorderLevel: Number(data.reorderLevel) || 0,
      location: data.location || "",
    });

    await logAudit({ user: req.user._id, action: "Create Item", entityType: "Stock", details: data.itemName });

    res.redirect(`/stock?message=${encodeURIComponent("Stock Item Added Successfully")}`);
  } catch (err) {
    res.status(400).render("stock/new", { error: err.message, form: req.body });
  }
}

/**
 * Port of recordStockTransaction() — validates OUT never exceeds
 * currentStock, matching the original exactly. Extracted to an
 * internal function (no req/res, takes an itemName lookup + actor
 * strings directly) so other modules can genuinely move stock instead
 * of just flagging a status — same "internal function backing a real
 * side effect" pattern as assetController.js's issueAssetInternal().
 * Phase 10's Material Requests (materialRequestController.js) is the
 * first caller; the route handler below is now a thin wrapper.
 */
async function recordTransactionInternal({ itemId, itemName, type, quantity, reason, performedByEmail, actorId }) {
  const qty = Number(quantity);
  if (!["IN", "OUT"].includes(type)) throw new Error("Type must be IN or OUT.");
  if (!qty || qty <= 0) throw new Error("Quantity must be greater than 0.");

  const item = itemId ? await StockItem.findOne({ itemId }).lean() : await StockItem.findOne({ itemName }).lean();
  if (!item) throw new Error(`Stock item ${itemId || itemName} not found.`);

  const [withStock] = await withCurrentStock([item]);

  if (type === "OUT" && qty > withStock.currentStock) {
    throw new Error(`Cannot remove ${qty} — only ${withStock.currentStock} ${item.unit} currently in stock.`);
  }

  const transactionId = await generateSequentialId("STKTX");
  await StockTransaction.create({
    transactionId,
    itemId: item.itemId,
    itemName: item.itemName,
    type,
    quantity: qty,
    reason: reason || "",
    performedBy: performedByEmail,
  });

  await logAudit({ user: actorId, action: type, entityType: "Stock", details: `${item.itemName} — ${qty} ${item.unit}` });

  // Original also emailed HR/Managers a Low Stock Alert once a
  // transaction pushed an item at/below reorder level — no email
  // provider yet (see MIGRATION.md), so the badge on the list page
  // is the alert, same "record instead of emailing" substitution
  // used everywhere else in this migration.

  return item;
}

async function recordTransaction(req, res) {
  try {
    const { itemId, type, quantity, reason } = req.body;
    const item = await recordTransactionInternal({ itemId, type, quantity, reason, performedByEmail: req.user.email, actorId: req.user._id });
    res.redirect(`/stock?message=${encodeURIComponent(`Stock ${type} recorded successfully for ${item.itemName}.`)}`);
  } catch (err) {
    res.redirect(`/stock?message=${encodeURIComponent(err.message)}`);
  }
}

async function itemTransactions(req, res) {
  const item = await StockItem.findOne({ itemId: req.params.itemId }).lean();
  if (!item) return res.status(404).render("errors/404");

  const [withStock] = await withCurrentStock([item]);
  const transactions = await StockTransaction.find({ itemId: item.itemId }).sort({ date: -1 }).lean();

  res.render("stock/transactions", { item: withStock, transactions });
}

module.exports = { listStock, showNewForm, createItem, recordTransaction, recordTransactionInternal, itemTransactions };
