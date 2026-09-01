/*************************************************************
 * vendorController.js — port of VendorEngine.gs.
 *************************************************************/
const Vendor = require("../models/Vendor");
const { VENDOR_CATEGORY, VENDOR_STATUS } = Vendor;
const { logAudit } = require("../utils/auditLog");

async function listVendors(req, res) {
  const vendors = await Vendor.find().sort({ name: 1 }).lean();
  res.render("vendors/list", { vendors, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("vendors/form", { editing: false, error: null, form: {}, VENDOR_CATEGORY, VENDOR_STATUS });
}

async function createVendor(req, res) {
  try {
    const data = req.body;
    if (!data.name) throw new Error("Vendor Name is required.");

    const vendor = await Vendor.create({
      name: data.name,
      contactPerson: data.contactPerson || "",
      email: data.email || "",
      phone: data.phone || "",
      category: data.category || VENDOR_CATEGORY.OTHER,
      amcExpiry: data.amcExpiry ? new Date(data.amcExpiry) : undefined,
      status: data.status || VENDOR_STATUS.ACTIVE,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Vendor", entityId: vendor._id, details: data.category || "" });

    res.redirect("/vendors?message=Vendor Added Successfully");
  } catch (err) {
    res.status(400).render("vendors/form", { editing: false, error: err.message, form: req.body, VENDOR_CATEGORY, VENDOR_STATUS });
  }
}

async function showEditForm(req, res) {
  const vendor = await Vendor.findById(req.params.id).lean();
  if (!vendor) return res.status(404).render("errors/404");
  res.render("vendors/form", { editing: true, error: null, form: vendor, VENDOR_CATEGORY, VENDOR_STATUS });
}

async function updateVendor(req, res) {
  try {
    const data = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).render("errors/404");

    vendor.name = data.name;
    vendor.contactPerson = data.contactPerson || "";
    vendor.email = data.email || "";
    vendor.phone = data.phone || "";
    vendor.category = data.category || VENDOR_CATEGORY.OTHER;
    vendor.amcExpiry = data.amcExpiry ? new Date(data.amcExpiry) : undefined;
    vendor.status = data.status || VENDOR_STATUS.ACTIVE;
    await vendor.save();

    await logAudit({ user: req.user._id, action: "Update", entityType: "Vendor", entityId: vendor._id, details: "" });

    res.redirect("/vendors?message=Vendor Updated Successfully");
  } catch (err) {
    res.status(400).render("vendors/form", { editing: true, error: err.message, form: { _id: req.params.id, ...req.body }, VENDOR_CATEGORY, VENDOR_STATUS });
  }
}

module.exports = { listVendors, showNewForm, createVendor, showEditForm, updateVendor };
