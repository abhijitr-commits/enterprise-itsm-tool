/*************************************************************
 * itAllocationController.js — port of ITAssetAllocationEngine.gs.
 *
 * A real allocation workflow — not a checkbox pretending something
 * happened. Selecting assets here actually calls issueAssetInternal()
 * against the real Asset Register (assetController.js), so the asset
 * genuinely becomes assigned to the new joiner, with full Asset
 * History logging already built into Asset Management.
 *************************************************************/
const ITAllocation = require("../models/ITAllocation");
const ChecklistItem = require("../models/Checklist");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { markChecklistTaskDone } = require("../utils/checklists");
const { issueAssetInternal } = require("./assetController");

const PROVISIONING_TASK = "IT Asset Provisioning Requested";

/**
 * Port of getPendingITProvisioningSafe() — pulled from the
 * Pre-Onboarding checklist, so IT sees exactly who needs equipment
 * without cross-referencing HR's checklist manually.
 */
async function listAllocations(req, res) {
  const [pending, history] = await Promise.all([
    ChecklistItem.find({ type: CHECKLIST_TYPE.PRE_ONBOARDING, task: PROVISIONING_TASK, status: { $ne: "Done" } })
      .sort({ employee: 1 })
      .lean(),
    ITAllocation.find().sort({ allocationDate: -1 }).lean(),
  ]);

  res.render("it-allocation/list", {
    pending,
    history,
    message: req.query.message || null,
  });
}

async function showAllocateForm(req, res) {
  const { employee, department } = req.query;

  const [availableAssets, employeeRecord] = await Promise.all([
    Asset.find({ $or: [{ assignedTo: "" }, { assignedTo: { $exists: false } }], status: { $ne: Asset.ASSET_STATUS.DECOMMISSIONED } })
      .sort({ assetName: 1 })
      .lean(),
    Employee.findOne({ name: employee }).lean(),
  ]);

  res.render("it-allocation/allocate", {
    error: null,
    employee: employee || "",
    department: department || (employeeRecord && employeeRecord.department) || "",
    designation: (employeeRecord && employeeRecord.designation) || "",
    availableAssets,
  });
}

/**
 * Port of allocateAssetsToEmployee() — actually calls
 * issueAssetInternal() for each selected asset, then records the
 * allocation and marks the Pre-Onboarding "IT Asset Provisioning
 * Requested" task Done. The original also emailed the employee what
 * they'd been allocated; no email provider yet (see MIGRATION.md), so
 * that step is skipped, same as every other "would have emailed
 * someone" point in this migration.
 */
async function allocateAssets(req, res) {
  try {
    const { employee, department, designation, notes } = req.body;
    const assetIds = [].concat(req.body.assetIds || []).filter(Boolean);

    if (!employee) throw new Error("Employee is required.");
    if (assetIds.length === 0) throw new Error("Select at least one asset to allocate.");

    const failures = [];
    for (const assetId of assetIds) {
      const result = await issueAssetInternal(assetId, employee, req.user._id);
      if (!result.success) failures.push(result.message);
    }

    const allocationId = await generateSequentialId("ALLOC");
    await ITAllocation.create({
      allocationId,
      employee,
      department: department || "",
      designation: designation || "",
      assetIds,
      notes: notes || "",
      allocatedBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Allocate",
      entityType: "IT Allocation",
      details: `${employee} — ${assetIds.length} asset(s)`,
    });

    await markChecklistTaskDone(CHECKLIST_TYPE.PRE_ONBOARDING, employee, PROVISIONING_TASK, req.user._id);

    const message = failures.length === 0
      ? `Allocated ${assetIds.length} asset(s) to ${employee} successfully.`
      : `Allocated with some issues: ${failures.join("; ")}`;

    res.redirect(`/asset-allocation?message=${encodeURIComponent(message)}`);
  } catch (err) {
    res.status(400).render("it-allocation/allocate", {
      error: err.message,
      employee: req.body.employee || "",
      department: req.body.department || "",
      designation: req.body.designation || "",
      availableAssets: await Asset.find({ $or: [{ assignedTo: "" }, { assignedTo: { $exists: false } }], status: { $ne: Asset.ASSET_STATUS.DECOMMISSIONED } }).lean(),
    });
  }
}

module.exports = { listAllocations, showAllocateForm, allocateAssets };
