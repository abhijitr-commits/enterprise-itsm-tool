/*************************************************************
 * workOrderController.js — Phase 10 addition. Job/work-order tracking
 * shared by every hands-on-hardware department (Production, Robotics,
 * Electrical, Electronics, Technical, Software) via a plain
 * `department` field — see models/WorkOrder.js.
 *************************************************************/
const WorkOrder = require("../models/WorkOrder");
const { WORK_ORDER_STATUS } = WorkOrder;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listWorkOrders(req, res) {
  const { department, status } = req.query;

  const filter = {};
  if (department) filter.department = department;
  if (status) filter.status = status;

  const orders = await WorkOrder.find(filter).sort({ createdDate: -1 }).lean();
  res.render("work-orders/list", { orders, WORK_ORDER_STATUS, query: { department: department || "", status: status || "" }, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("work-orders/new", { error: null, form: {} });
}

async function createWorkOrder(req, res) {
  try {
    const data = req.body;
    if (!data.department) throw new Error("Department is required.");
    if (!data.itemDescription) throw new Error("Item Description is required.");

    const workOrderId = await generateSequentialId("WO");
    await WorkOrder.create({
      workOrderId,
      department: data.department,
      relatedSalesOrder: data.relatedSalesOrder || "",
      relatedAsset: data.relatedAsset || "",
      itemDescription: data.itemDescription,
      quantity: data.quantity || 1,
      assignedTo: data.assignedTo || "",
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      targetCompletionDate: data.targetCompletionDate ? new Date(data.targetCompletionDate) : undefined,
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Work Order", details: `${data.department} — ${data.itemDescription}` });

    res.redirect(`/work-orders?message=${encodeURIComponent("Work Order Created Successfully")}`);
  } catch (err) {
    res.status(400).render("work-orders/new", { error: err.message, form: req.body });
  }
}

async function updateWorkOrder(req, res) {
  try {
    const { status, assignedTo, defectNotes } = req.body;
    if (!Object.values(WORK_ORDER_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const order = await WorkOrder.findById(req.params.id);
    if (!order) return res.status(404).render("errors/404");

    order.status = status;
    if (assignedTo !== undefined) order.assignedTo = assignedTo;
    if (defectNotes) order.defectNotes = defectNotes;
    if (status === WORK_ORDER_STATUS.COMPLETED && !order.completedDate) order.completedDate = new Date();
    await order.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Work Order", entityId: order._id, details: status });

    res.redirect(`/work-orders?message=${encodeURIComponent(`Work Order status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listWorkOrders, showNewForm, createWorkOrder, updateWorkOrder };
