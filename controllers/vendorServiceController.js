/*************************************************************
 * vendorServiceController.js — port of VendorServiceEngine.gs.
 * Tracks service issues raised against real vendors (the Vendor
 * collection) — a service log, not a duplicate vendor directory.
 * IT-team gated throughout, matching requireITTeam() in the original.
 *************************************************************/
const VendorServiceLog = require("../models/VendorServiceLog");
const Vendor = require("../models/Vendor");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listLogs(req, res) {
  const [logs, vendors] = await Promise.all([
    VendorServiceLog.find().sort({ raisedDate: -1 }).lean(),
    Vendor.find({ status: "Active" }).sort({ name: 1 }).lean(),
  ]);

  res.render("vendor-service/list", { logs, vendors, message: req.query.message || null });
}

async function logIssue(req, res) {
  try {
    const { vendor, issue, priority } = req.body;
    if (!vendor) throw new Error("Vendor is required.");
    if (!issue) throw new Error("Issue description is required.");

    const logId = await generateSequentialId("VSVC");
    await VendorServiceLog.create({
      logId,
      vendor,
      issue,
      priority: priority || "Normal",
      raisedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Log Issue", entityType: "Vendor Service", details: `${vendor} — ${issue}` });

    res.redirect(`/vendor-service?message=${encodeURIComponent("Service issue logged.")}`);
  } catch (err) {
    res.redirect(`/vendor-service?message=${encodeURIComponent(err.message)}`);
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const log = await VendorServiceLog.findById(req.params.id);
    if (!log) return res.status(404).render("errors/404");

    log.status = status;
    if (status === "Resolved") log.resolvedDate = new Date();
    await log.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Vendor Service", entityId: log._id, details: status });

    res.redirect(`/vendor-service?message=${encodeURIComponent(`Status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listLogs, logIssue, updateStatus };
