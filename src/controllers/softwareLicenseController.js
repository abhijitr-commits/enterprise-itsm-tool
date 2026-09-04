/*************************************************************
 * softwareLicenseController.js — port of SoftwareLicenseEngine.gs.
 *************************************************************/
const SoftwareLicense = require("../models/SoftwareLicense");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listLicenses(req, res) {
  const licenses = await SoftwareLicense.find().sort({ softwareName: 1 }).lean();
  res.render("licenses/list", { licenses, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("licenses/form", { editing: false, error: null, form: {} });
}

async function createLicense(req, res) {
  try {
    const data = req.body;
    if (!data.softwareName) throw new Error("Software Name is required.");

    const licenseId = await generateSequentialId("LIC");
    await SoftwareLicense.create({
      licenseId,
      softwareName: data.softwareName,
      vendor: data.vendor || "",
      licenseType: data.licenseType || "",
      seatsTotal: Number(data.seatsTotal) || 0,
      seatsUsed: Number(data.seatsUsed) || 0,
      cost: data.cost || undefined,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Software License", details: data.softwareName });

    res.redirect(`/licenses?message=${encodeURIComponent("License Added Successfully")}`);
  } catch (err) {
    res.status(400).render("licenses/form", { editing: false, error: err.message, form: req.body });
  }
}

async function showEditForm(req, res) {
  const license = await SoftwareLicense.findById(req.params.id).lean();
  if (!license) return res.status(404).render("errors/404");
  res.render("licenses/form", { editing: true, error: null, form: license });
}

async function updateLicense(req, res) {
  try {
    const data = req.body;
    const license = await SoftwareLicense.findById(req.params.id);
    if (!license) return res.status(404).render("errors/404");

    license.softwareName = data.softwareName;
    license.vendor = data.vendor || "";
    license.licenseType = data.licenseType || "";
    license.seatsTotal = Number(data.seatsTotal) || 0;
    license.seatsUsed = Number(data.seatsUsed) || 0;
    license.cost = data.cost || undefined;
    license.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : undefined;
    license.expiryDate = data.expiryDate ? new Date(data.expiryDate) : undefined;
    license.status = data.status || "Active";
    await license.save();

    await logAudit({ user: req.user._id, action: "Update", entityType: "Software License", entityId: license._id, details: data.softwareName });

    res.redirect(`/licenses?message=${encodeURIComponent("License Updated Successfully.")}`);
  } catch (err) {
    res.status(400).render("licenses/form", { editing: true, error: err.message, form: { _id: req.params.id, ...req.body } });
  }
}

module.exports = { listLicenses, showNewForm, createLicense, showEditForm, updateLicense };
