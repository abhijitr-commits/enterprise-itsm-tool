/*************************************************************
 * requirementController.js — port of RequirementEngine.gs.
 *
 * A lightweight RFQ (Request for Quotation) style workflow — genuinely
 * distinct from the Purchase Register, which tracks completed POs.
 * Usable by both IT and Admin/Procurement — gated by isITTeam() OR
 * isAdminTeam() in the routes file, same as the original's inline
 * "!isITTeam() && !isAdminTeam()" check (neither is a Permission
 * Matrix key here, matching the original).
 *
 * Deviation: the original emails the vendor directly via MailApp once
 * a requirement is sent. No email provider is wired up yet (see
 * MIGRATION.md) — the request is still recorded and tracked through
 * its full status lifecycle, just not auto-emailed, same as every
 * other "would have emailed someone" point in this migration.
 *************************************************************/
const Requirement = require("../models/Requirement");
const { REQUIREMENT_STATUS } = Requirement;
const Vendor = require("../models/Vendor");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listRequirements(req, res) {
  const [requirements, vendors] = await Promise.all([
    Requirement.find().sort({ sentDate: -1 }).lean(),
    Vendor.find({ status: "Active" }).sort({ name: 1 }).lean(),
  ]);

  res.render("requirements/list", { requirements, vendors, REQUIREMENT_STATUS, message: req.query.message || null });
}

async function submitRequirement(req, res) {
  try {
    const data = req.body;
    if (!data.vendorEmail) throw new Error("Vendor email is required.");
    if (!data.description) throw new Error("Requirement description is required.");

    const requirementId = await generateSequentialId("REQMT");
    await Requirement.create({
      requirementId,
      raisedBy: req.user.name,
      department: data.department || "",
      vendorName: data.vendorName || "",
      vendorEmail: data.vendorEmail,
      description: data.description,
      priority: data.priority || "Normal",
    });

    await logAudit({
      user: req.user._id,
      action: "Sent",
      entityType: "Requirement",
      details: `${data.vendorName || data.vendorEmail} — ${data.description}`,
    });

    res.redirect(`/requirements?message=${encodeURIComponent(`Requirement request recorded for ${data.vendorEmail}.`)}`);
  } catch (err) {
    res.redirect(`/requirements?message=${encodeURIComponent(err.message)}`);
  }
}

async function updateStatus(req, res) {
  try {
    const { status, notes } = req.body;
    if (!Object.values(REQUIREMENT_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const requirement = await Requirement.findById(req.params.id);
    if (!requirement) return res.status(404).render("errors/404");

    requirement.status = status;
    if (notes) requirement.notes = notes;
    await requirement.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Requirement", entityId: requirement._id, details: status });

    res.redirect(`/requirements?message=${encodeURIComponent(`Status updated to ${status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listRequirements, submitRequirement, updateStatus };
