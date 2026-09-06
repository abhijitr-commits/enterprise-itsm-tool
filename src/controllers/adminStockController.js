/*************************************************************
 * adminStockController.js — Administration-department Stock
 * Management + Stock Order Management, modeled on the user-supplied
 * Pashan Stock Register spreadsheet (Inventory sheet + Order sheet).
 *
 * Same "never store current stock as an editable number" rule as
 * stockController.js — see withCurrentStock() below — plus a box/
 * loose-piece unit conversion the plain Stock module doesn't have,
 * and a real Order Register (AdminStockOrder) with a receive step
 * that writes a real IN transaction instead of just editing a count.
 *************************************************************/
const AdminStockItem = require("../models/AdminStockItem");
const AdminStockTransaction = require("../models/AdminStockTransaction");
const AdminStockOrder = require("../models/AdminStockOrder");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

/** Box + loose-piece display, e.g. "3 Box + 4 Pc" — same idea as the sheet's "Display Stock" column. */
function boxDisplay(pieces, piecesPerBox) {
  const perBox = piecesPerBox && piecesPerBox > 1 ? piecesPerBox : null;
  if (!perBox) return `${pieces} pc`;
  const boxes = Math.floor(pieces / perBox);
  const loose = pieces % perBox;
  return `${boxes} Box + ${loose} Pc`;
}

/** Same pattern as stockController.js's withCurrentStock() — sums the ledger once for every item instead of querying per item. */
async function withCurrentStock(items) {
  const transactions = await AdminStockTransaction.find({ itemId: { $in: items.map((i) => i.itemId) } }).lean();

  const inTotals = {};
  const outTotals = {};
  transactions.forEach((t) => {
    if (t.type === "IN") inTotals[t.itemId] = (inTotals[t.itemId] || 0) + t.quantity;
    else if (t.type === "OUT") outTotals[t.itemId] = (outTotals[t.itemId] || 0) + t.quantity;
  });

  return items.map((item) => {
    const currentStock = item.openingStock + (inTotals[item.itemId] || 0) - (outTotals[item.itemId] || 0);
    return {
      ...item,
      currentStock,
      critical: currentStock <= item.minBufferStock,
      displayStock: boxDisplay(currentStock, item.piecesPerBox),
    };
  });
}

async function listStock(req, res) {
  const items = await AdminStockItem.find().sort({ itemName: 1 }).lean();
  let withStock = await withCurrentStock(items);

  const criticalOnly = req.query.critical === "1";
  if (criticalOnly) withStock = withStock.filter((i) => i.critical);

  res.render("admin-stock/list", {
    items: withStock,
    criticalOnly,
    message: req.query.message || null,
  });
}

function showNewForm(req, res) {
  res.render("admin-stock/new", { error: null, form: {} });
}

async function createItem(req, res) {
  try {
    const data = req.body;
    if (!data.itemName) throw new Error("Item Name is required.");

    const piecesPerBox = Math.max(1, Number(data.piecesPerBox) || 1);
    const openingBoxes = Number(data.openingBoxes) || 0;
    const openingLoosePieces = Number(data.openingLoosePieces) || 0;
    const openingStock = openingBoxes * piecesPerBox + openingLoosePieces;

    const itemId = await generateSequentialId("ASTK");
    await AdminStockItem.create({
      itemId,
      itemCode: data.itemCode || "",
      itemName: data.itemName,
      category: data.category || "General",
      unit: data.unit || "pcs",
      piecesPerBox,
      openingBoxes,
      openingLoosePieces,
      openingStock,
      minBufferStock: Number(data.minBufferStock) || 0,
      location: data.location || "",
      remarks: data.remarks || "",
    });

    await logAudit({ user: req.user._id, action: "Create Item", entityType: "AdminStock", details: data.itemName });

    res.redirect(`/admin/stock?message=${encodeURIComponent("Stock Item Added Successfully")}`);
  } catch (err) {
    res.status(400).render("admin-stock/new", { error: err.message, form: req.body });
  }
}

async function recordTransaction(req, res) {
  try {
    const { itemId, type, quantity, reason } = req.body;
    const qty = Number(quantity);
    if (!["IN", "OUT"].includes(type)) throw new Error("Type must be IN or OUT.");
    if (!qty || qty <= 0) throw new Error("Quantity must be greater than 0.");

    const item = await AdminStockItem.findOne({ itemId }).lean();
    if (!item) throw new Error(`Stock item ${itemId} not found.`);

    const [withStock] = await withCurrentStock([item]);
    if (type === "OUT" && qty > withStock.currentStock) {
      throw new Error(`Cannot remove ${qty} — only ${withStock.currentStock} ${item.unit} currently in stock.`);
    }

    const transactionId = await generateSequentialId("ASTKTX");
    await AdminStockTransaction.create({
      transactionId,
      itemId: item.itemId,
      itemName: item.itemName,
      type,
      quantity: qty,
      reason: reason || "",
      performedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: type, entityType: "AdminStock", details: `${item.itemName} — ${qty} ${item.unit}` });

    res.redirect(`/admin/stock?message=${encodeURIComponent(`Stock ${type} recorded successfully for ${item.itemName}.`)}`);
  } catch (err) {
    res.redirect(`/admin/stock?message=${encodeURIComponent(err.message)}`);
  }
}

async function itemTransactions(req, res) {
  const item = await AdminStockItem.findOne({ itemId: req.params.itemId }).lean();
  if (!item) return res.status(404).render("errors/404");

  const [withStock] = await withCurrentStock([item]);
  const transactions = await AdminStockTransaction.find({ itemId: item.itemId }).sort({ date: -1 }).lean();

  res.render("admin-stock/transactions", { item: withStock, transactions });
}

/* ---------------- Stock Order Management (Order Register) ---------------- */

async function listOrders(req, res) {
  const orders = await AdminStockOrder.find().sort({ createdAt: -1 }).lean();
  res.render("admin-stock/orders", { orders, message: req.query.message || null });
}

async function showNewOrderForm(req, res) {
  const items = await AdminStockItem.find().sort({ itemName: 1 }).lean();
  res.render("admin-stock/order-form", { error: null, form: {}, items });
}

async function createOrder(req, res) {
  try {
    const data = req.body;
    if (!data.itemId) throw new Error("Item is required.");

    const item = await AdminStockItem.findOne({ itemId: data.itemId }).lean();
    if (!item) throw new Error("Stock item not found.");

    const orderId = await generateSequentialId("ASTKORD");
    await AdminStockOrder.create({
      orderId,
      itemId: item.itemId,
      itemName: item.itemName,
      orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
      decision: data.decision || "Order",
      remarks: data.remarks || "",
      raisedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create Order", entityType: "AdminStockOrder", details: item.itemName });

    res.redirect(`/admin/stock/orders?message=${encodeURIComponent("Stock Order Raised Successfully")}`);
  } catch (err) {
    const items = await AdminStockItem.find().sort({ itemName: 1 }).lean();
    res.status(400).render("admin-stock/order-form", { error: err.message, form: req.body, items });
  }
}

/**
 * Marks a Pending order Received: computes the received quantity in
 * pieces from Received Boxes/Loose PC against the item's piecesPerBox
 * (same conversion as createItem()), records payment/bill details, and
 * — the whole point of a real Order Register instead of just a status
 * flag — writes a genuine AdminStockTransaction IN so the item's
 * current stock actually reflects the goods received.
 */
async function markReceived(req, res) {
  try {
    const order = await AdminStockOrder.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).render("errors/404");
    if (order.status === "Received") throw new Error("This order has already been marked received.");

    const data = req.body;
    const item = await AdminStockItem.findOne({ itemId: order.itemId }).lean();
    if (!item) throw new Error(`Stock item ${order.itemId} not found.`);

    const receivedBoxes = Number(data.receivedBoxes) || 0;
    const receivedLoosePieces = Number(data.receivedLoosePieces) || 0;
    const receivedStockPieces = receivedBoxes * item.piecesPerBox + receivedLoosePieces;
    if (receivedStockPieces <= 0) throw new Error("Received quantity must be greater than 0.");

    order.receivedBoxes = receivedBoxes;
    order.receivedLoosePieces = receivedLoosePieces;
    order.receivedStockPieces = receivedStockPieces;
    order.receivedDate = new Date();
    order.referenceBillNo = data.referenceBillNo || "";
    order.paymentStatus = data.paymentStatus || "Pending";
    order.paymentDate = data.paymentDate ? new Date(data.paymentDate) : undefined;
    if (data.remarks) order.remarks = data.remarks;
    order.status = "Received";
    order.decision = "Done";
    await order.save();

    const transactionId = await generateSequentialId("ASTKTX");
    await AdminStockTransaction.create({
      transactionId,
      itemId: item.itemId,
      itemName: item.itemName,
      type: "IN",
      quantity: receivedStockPieces,
      reason: `Stock Order ${order.orderId}${order.referenceBillNo ? ` — Bill ${order.referenceBillNo}` : ""}`,
      performedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Receive Order", entityType: "AdminStockOrder", entityId: order._id, details: `${item.itemName} — ${receivedStockPieces} pc` });

    res.redirect(`/admin/stock/orders?message=${encodeURIComponent(`Order ${order.orderId} marked received — stock updated.`)}`);
  } catch (err) {
    res.redirect(`/admin/stock/orders?message=${encodeURIComponent(err.message)}`);
  }
}

async function updatePayment(req, res) {
  try {
    const order = await AdminStockOrder.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).render("errors/404");

    order.paymentStatus = req.body.paymentStatus || order.paymentStatus;
    order.paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : order.paymentDate;
    if (req.body.referenceBillNo) order.referenceBillNo = req.body.referenceBillNo;
    await order.save();

    await logAudit({ user: req.user._id, action: "Update Payment", entityType: "AdminStockOrder", entityId: order._id, details: order.paymentStatus });

    res.redirect(`/admin/stock/orders?message=${encodeURIComponent(`Payment status updated for ${order.orderId}.`)}`);
  } catch (err) {
    res.redirect(`/admin/stock/orders?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = {
  listStock,
  showNewForm,
  createItem,
  recordTransaction,
  itemTransactions,
  listOrders,
  showNewOrderForm,
  createOrder,
  markReceived,
  updatePayment,
};
