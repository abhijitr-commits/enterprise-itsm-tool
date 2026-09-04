/*************************************************************
 * salesController.js — Phase 10 addition, modeled on
 * purchaseController.js's shape (list + create + inline status
 * update, no separate detail page) since a Sales Order's lifecycle is
 * the same kind of "record it, then move it through a small set of
 * statuses" shape as a Purchase Order.
 *************************************************************/
const SalesOrder = require("../models/SalesOrder");
const { SALES_ORDER_STATUS } = SalesOrder;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listSalesOrders(req, res) {
  const orders = await SalesOrder.find().sort({ createdDate: -1 }).lean();
  res.render("sales/list", { orders, SALES_ORDER_STATUS, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("sales/new", { error: null, form: {} });
}

async function createSalesOrder(req, res) {
  try {
    const data = req.body;
    if (!data.customerName) throw new Error("Customer Name is required.");
    if (!data.itemDescription) throw new Error("Item Description is required.");
    if (!data.quantity) throw new Error("Quantity is required.");

    const salesOrderId = await generateSequentialId("SO");
    await SalesOrder.create({
      salesOrderId,
      customerName: data.customerName,
      customerEmail: data.customerEmail || "",
      itemDescription: data.itemDescription,
      quantity: data.quantity,
      amount: data.amount || undefined,
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      notes: data.notes || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Sales Order", details: `${data.customerName} — ${data.itemDescription}` });

    res.redirect(`/sales?message=${encodeURIComponent("Sales Order Created Successfully")}`);
  } catch (err) {
    res.status(400).render("sales/new", { error: err.message, form: req.body });
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!Object.values(SALES_ORDER_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const order = await SalesOrder.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!order) return res.status(404).render("errors/404");

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Sales Order", entityId: order._id, details: status });

    res.redirect(`/sales?message=${encodeURIComponent(`Sales Order status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listSalesOrders, showNewForm, createSalesOrder, updateStatus };
