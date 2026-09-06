/*************************************************************
 * adminAssetController.js — Administration-department Asset
 * Register (office/facility assets: furniture, office equipment,
 * pantry appliances, etc.), a field-for-field mirror of
 * assetController.js's own register/edit shape, pointed at the
 * separate AdminAsset collection so IT's Asset Register and this
 * one never mix warranty reports. See AdminAsset.js.
 *************************************************************/
const AdminAsset = require("../models/AdminAsset");
const { ADMIN_ASSET_STATUS } = AdminAsset;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listAssets(req, res) {
  const assets = await AdminAsset.find().sort({ createdDate: -1 }).lean();
  res.render("admin-assets/list", { assets, ADMIN_ASSET_STATUS, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("admin-assets/form", { editing: false, error: null, form: {}, ADMIN_ASSET_STATUS });
}

async function createAsset(req, res) {
  try {
    const data = req.body;
    if (!data.assetName) throw new Error("Asset Name is required.");
    if (!data.type) throw new Error("Type is required.");
    if (!data.location) throw new Error("Location is required.");

    const assetId = await generateSequentialId("ADAST");
    const asset = await AdminAsset.create({
      assetId,
      assetName: data.assetName,
      type: data.type,
      serialNumber: data.serialNumber || "",
      assignedTo: data.assignedTo || "",
      department: data.department || "Administration",
      location: data.location,
      status: data.status || ADMIN_ASSET_STATUS.IN_SERVICE,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined,
      vendor: data.vendor || "",
      remarks: data.remarks || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "AdminAsset", entityId: asset._id, details: data.assetName });

    res.redirect("/admin/assets?message=Asset Added Successfully");
  } catch (err) {
    res.status(400).render("admin-assets/form", { editing: false, error: err.message, form: req.body, ADMIN_ASSET_STATUS });
  }
}

async function showEditForm(req, res) {
  const asset = await AdminAsset.findOne({ assetId: req.params.assetId }).lean();
  if (!asset) return res.status(404).render("errors/404");
  res.render("admin-assets/form", { editing: true, error: null, form: asset, ADMIN_ASSET_STATUS });
}

async function updateAsset(req, res) {
  try {
    const data = req.body;
    const asset = await AdminAsset.findOne({ assetId: req.params.assetId });
    if (!asset) return res.status(404).render("errors/404");

    asset.assetName = data.assetName;
    asset.type = data.type;
    asset.serialNumber = data.serialNumber || "";
    asset.assignedTo = data.assignedTo || "";
    asset.department = data.department || "Administration";
    asset.location = data.location;
    asset.status = data.status || ADMIN_ASSET_STATUS.IN_SERVICE;
    asset.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : undefined;
    asset.warrantyExpiry = data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined;
    asset.vendor = data.vendor || "";
    asset.remarks = data.remarks || "";
    await asset.save();

    await logAudit({ user: req.user._id, action: "Update", entityType: "AdminAsset", entityId: asset._id, details: asset.assetName });

    res.redirect("/admin/assets?message=Asset Updated Successfully");
  } catch (err) {
    res.status(400).render("admin-assets/form", { editing: true, error: err.message, form: { assetId: req.params.assetId, ...req.body }, ADMIN_ASSET_STATUS });
  }
}

module.exports = { listAssets, showNewForm, createAsset, showEditForm, updateAsset };
