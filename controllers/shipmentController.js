/*************************************************************
 * shipmentController.js — Phase 10 addition. Inbound + outbound
 * shipment tracking for Logistics — see models/Shipment.js for why
 * one model covers both directions.
 *************************************************************/
const Shipment = require("../models/Shipment");
const { SHIPMENT_DIRECTION, SHIPMENT_STATUS } = Shipment;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listShipments(req, res) {
  const { direction, status } = req.query;

  const filter = {};
  if (direction) filter.direction = direction;
  if (status) filter.status = status;

  const shipments = await Shipment.find(filter).sort({ createdDate: -1 }).lean();
  res.render("shipments/list", { shipments, SHIPMENT_DIRECTION, SHIPMENT_STATUS, query: { direction: direction || "", status: status || "" }, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("shipments/new", { error: null, form: {}, SHIPMENT_DIRECTION });
}

async function createShipment(req, res) {
  try {
    const data = req.body;
    if (!Object.values(SHIPMENT_DIRECTION).includes(data.direction)) throw new Error("A valid direction (Inbound/Outbound) is required.");
    if (!data.destination) throw new Error("Destination is required.");

    const shipmentId = await generateSequentialId("SHIP");
    await Shipment.create({
      shipmentId,
      direction: data.direction,
      relatedOrder: data.relatedOrder || "",
      carrier: data.carrier || "",
      trackingNumber: data.trackingNumber || "",
      origin: data.origin || "",
      destination: data.destination,
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      notes: data.notes || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Shipment", details: `${data.direction} to ${data.destination}` });

    res.redirect(`/shipments?message=${encodeURIComponent("Shipment Created Successfully")}`);
  } catch (err) {
    res.status(400).render("shipments/new", { error: err.message, form: req.body, SHIPMENT_DIRECTION });
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!Object.values(SHIPMENT_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).render("errors/404");

    shipment.status = status;
    if (status === SHIPMENT_STATUS.DISPATCHED && !shipment.dispatchDate) shipment.dispatchDate = new Date();
    if (status === SHIPMENT_STATUS.DELIVERED && !shipment.actualDeliveryDate) shipment.actualDeliveryDate = new Date();
    await shipment.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Shipment", entityId: shipment._id, details: status });

    res.redirect(`/shipments?message=${encodeURIComponent(`Shipment status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listShipments, showNewForm, createShipment, updateStatus };
