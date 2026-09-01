/*************************************************************
 * assetController.js — port of AssetEngine.gs.
 *************************************************************/
const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

const { ASSET_STATUS } = Asset;

async function logAssetHistory(assetId, action, from, to, notes) {
  try {
    await AssetHistory.create({ assetId, action, from: from || "", to: to || "", notes: notes || "" });
  } catch (err) {
    console.error("Asset history log failed:", err.message);
  }
}

async function listAssets(req, res) {
  const { q, status, department } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["assetId", "assetName", "type", "serialNumber", "assignedTo", "department", "location", "vendor"].map((f) => ({ [f]: rx }));
  }

  const assets = await Asset.find(filter).sort({ createdDate: -1 }).lean();

  res.render("assets/list", {
    assets,
    query: { q: q || "", status: status || "", department: department || "" },
    ASSET_STATUS,
  });
}

function showNewForm(req, res) {
  res.render("assets/new", { error: null, form: {} });
}

async function createAsset(req, res) {
  try {
    const data = req.body;
    for (const field of ["assetName", "type", "department", "location"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const assetId = await generateSequentialId("AST");
    const status = data.assignedTo ? ASSET_STATUS.IN_SERVICE : ASSET_STATUS.IN_STORAGE;

    const asset = await Asset.create({
      assetId,
      assetName: data.assetName,
      type: data.type,
      serialNumber: data.serialNumber || "",
      assignedTo: data.assignedTo || "",
      department: data.department,
      location: data.location,
      status,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined,
      vendor: data.vendor || "",
      createdBy: req.user.email,
    });

    await logAssetHistory(assetId, "Created", "", data.assignedTo || "Unassigned", "Asset added to register");

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Asset",
      entityId: asset._id,
      details: data.assetName,
    });

    res.redirect(`/assets/${asset._id}?created=1`);
  } catch (err) {
    res.status(400).render("assets/new", { error: err.message, form: req.body });
  }
}

async function showAsset(req, res) {
  const asset = await Asset.findById(req.params.id).lean();
  if (!asset) return res.status(404).render("errors/404");

  const history = await AssetHistory.find({ assetId: asset.assetId }).sort({ date: -1 }).lean();

  res.render("assets/detail", {
    asset,
    history,
    ASSET_STATUS,
    justCreated: req.query.created === "1",
  });
}

async function updateAsset(req, res) {
  try {
    const data = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).render("errors/404");

    asset.assetName = data.assetName;
    asset.type = data.type;
    asset.serialNumber = data.serialNumber || "";
    asset.department = data.department;
    asset.location = data.location;
    asset.vendor = data.vendor || "";
    if (data.purchaseDate) asset.purchaseDate = new Date(data.purchaseDate);
    if (data.warrantyExpiry) asset.warrantyExpiry = new Date(data.warrantyExpiry);

    await asset.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Asset",
      entityId: asset._id,
      details: data.assetName,
    });

    res.redirect(`/assets/${asset._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function issueAsset(req, res) {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) throw new Error("Assignee name is required.");

    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).render("errors/404");

    const previousHolder = asset.assignedTo || "Unassigned";
    asset.assignedTo = assignedTo;
    asset.status = ASSET_STATUS.IN_SERVICE;
    await asset.save();

    await logAssetHistory(asset.assetId, "Issued", previousHolder, assignedTo, "");

    await logAudit({
      user: req.user._id,
      action: "Issue",
      entityType: "Asset",
      entityId: asset._id,
      details: `To: ${assignedTo}`,
    });

    res.redirect(`/assets/${asset._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function returnAsset(req, res) {
  const asset = await Asset.findById(req.params.id);
  if (!asset) return res.status(404).render("errors/404");

  const previousHolder = asset.assignedTo || "Unassigned";
  asset.assignedTo = "";
  asset.status = ASSET_STATUS.IN_STORAGE;
  await asset.save();

  await logAssetHistory(asset.assetId, "Returned", previousHolder, "Unassigned", "");

  await logAudit({
    user: req.user._id,
    action: "Return",
    entityType: "Asset",
    entityId: asset._id,
    details: `From: ${previousHolder}`,
  });

  res.redirect(`/assets/${asset._id}`);
}

async function decommissionAsset(req, res) {
  const asset = await Asset.findById(req.params.id);
  if (!asset) return res.status(404).render("errors/404");

  const previousStatus = asset.status;
  asset.status = ASSET_STATUS.DECOMMISSIONED;
  await asset.save();

  await logAssetHistory(asset.assetId, "Decommissioned", previousStatus, ASSET_STATUS.DECOMMISSIONED, "");

  await logAudit({
    user: req.user._id,
    action: "Decommission",
    entityType: "Asset",
    entityId: asset._id,
  });

  res.redirect(`/assets/${asset._id}`);
}

module.exports = {
  listAssets,
  showNewForm,
  createAsset,
  showAsset,
  updateAsset,
  issueAsset,
  returnAsset,
  decommissionAsset,
};
