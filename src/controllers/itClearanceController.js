/*************************************************************
 * itClearanceController.js — port of ITClearanceEngine.gs.
 *
 * A real IT clearance workflow for resignees — pulls the employee's
 * ACTUAL currently-assigned assets from the Asset Register (not a
 * free-text checklist), lets IT formally return each one (genuinely
 * updating Asset Register status via returnAssetInternal()), tracks
 * access revocation/account deactivation, and once everything is
 * done, automatically updates the IT Clearance column on the main
 * Resignation record via updateClearanceInternal() (resignationController.js)
 * — the same one shown in HR's Resignations tab.
 *************************************************************/
const ITClearanceRecord = require("../models/ITClearanceRecord");
const Resignation = require("../models/Resignation");
const Asset = require("../models/Asset");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { returnAssetInternal } = require("./assetController");
const { updateClearanceInternal } = require("./resignationController");

/**
 * Port of getPendingITClearancesSafe() — Resignations where IT
 * Clearance isn't done yet, so IT sees exactly who needs processing.
 */
async function listPendingClearances(req, res) {
  const pending = await Resignation.find({
    "clearances.it": { $ne: "Cleared" },
    status: { $ne: "Completed" },
  })
    .sort({ createdDate: -1 })
    .lean();

  res.render("it-clearance/list", { pending, message: req.query.message || null });
}

/**
 * Port of getAssignedAssetsForEmployee() — the assets ACTUALLY
 * currently assigned to this employee, straight from the real Asset
 * Register, which is what makes clearance real instead of a guess.
 */
async function showClearanceForm(req, res) {
  const resignation = await Resignation.findOne({ resignationId: req.params.resignationId }).lean();
  if (!resignation) return res.status(404).render("errors/404");

  const assignedAssets = await Asset.find({
    assignedTo: new RegExp(`^${resignation.employee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).lean();

  const history = await ITClearanceRecord.find({ resignationId: resignation.resignationId }).sort({ completedDate: -1 }).lean();

  res.render("it-clearance/form", { error: null, resignation, assignedAssets, history });
}

/**
 * Port of submitITClearance() — formally returns every selected asset,
 * records the clearance checklist, and only marks the parent
 * Resignation's IT Clearance "Cleared" once every checklist item
 * (access revoked / accounts deactivated / data backup completed) is
 * actually true — a partial clearance shouldn't silently look complete.
 */
async function submitClearance(req, res) {
  try {
    const resignation = await Resignation.findOne({ resignationId: req.params.resignationId });
    if (!resignation) return res.status(404).render("errors/404");

    const assetsReturned = [].concat(req.body.assetsReturned || []).filter(Boolean);
    const accessRevoked = req.body.accessRevoked === "1";
    const accountsDeactivated = req.body.accountsDeactivated === "1";
    const dataBackupCompleted = req.body.dataBackupCompleted === "1";

    const failures = [];
    for (const assetId of assetsReturned) {
      const result = await returnAssetInternal(assetId, req.user._id);
      if (!result.success) failures.push(result.message);
    }

    const clearanceId = await generateSequentialId("ITCLR");
    await ITClearanceRecord.create({
      clearanceId,
      resignationId: resignation.resignationId,
      employee: resignation.employee,
      assetsReturned,
      accessRevoked,
      accountsDeactivated,
      dataBackupCompleted,
      notes: req.body.notes || "",
      completedBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Submit",
      entityType: "IT Clearance",
      entityId: resignation._id,
      details: resignation.employee,
    });

    const allDone = accessRevoked && accountsDeactivated && dataBackupCompleted;

    let message;
    if (allDone) {
      const result = await updateClearanceInternal(resignation, "it", "Cleared", req.user._id);
      message = `IT Clearance completed and recorded — ${result.message}`;
    } else {
      message = "IT Clearance recorded, but not all items are checked yet — Resignation record NOT marked cleared.";
      if (failures.length) message += ` Asset return issues: ${failures.join("; ")}`;
    }

    res.redirect(`/it-clearance?message=${encodeURIComponent(message)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listPendingClearances, showClearanceForm, submitClearance };
