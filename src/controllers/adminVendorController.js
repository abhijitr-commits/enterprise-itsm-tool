/*************************************************************
 * adminVendorController.js — Administration-department vendor
 * directory + AMC tracking. Field-for-field mirror of
 * vendorController.js (the IT Vendor Management module), pointed at
 * the separate AdminVendor collection — see AdminVendor.js for why
 * this is a parallel module rather than a shared one.
 *************************************************************/
const AdminVendor = require("../models/AdminVendor");
const { ADMIN_VENDOR_CATEGORY, ADMIN_VENDOR_STATUS } = AdminVendor;
const { logAudit } = require("../utils/auditLog");

async function listVendors(req, res) {
  const vendors = await AdminVendor.find().sort({ name: 1 }).lean();
  res.render("admin-vendors/list", { vendors, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("admin-vendors/form", { editing: false, error: null, form: {}, ADMIN_VENDOR_CATEGORY, ADMIN_VENDOR_STATUS });
}

async function createVendor(req, res) {
  try {
    const data = req.body;
    if (!data.name) throw new Error("Vendor Name is required.");

    const vendor = await AdminVendor.create({
      name: data.name,
      contactPerson: data.contactPerson || "",
      email: data.email || "",
      phone: data.phone || "",
      category: data.category || ADMIN_VENDOR_CATEGORY.OTHER,
      amcExpiry: data.amcExpiry ? new Date(data.amcExpiry) : undefined,
      status: data.status || ADMIN_VENDOR_STATUS.ACTIVE,
      notes: data.notes || "",
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "AdminVendor", entityId: vendor._id, details: data.category || "" });

    res.redirect("/admin/vendors?message=Vendor Added Successfully");
  } catch (err) {
    res.status(400).render("admin-vendors/form", { editing: false, error: err.message, form: req.body, ADMIN_VENDOR_CATEGORY, ADMIN_VENDOR_STATUS });
  }
}

async function showEditForm(req, res) {
  const vendor = await AdminVendor.findById(req.params.id).lean();
  if (!vendor) return res.status(404).render("errors/404");
  res.render("admin-vendors/form", { editing: true, error: null, form: vendor, ADMIN_VENDOR_CATEGORY, ADMIN_VENDOR_STATUS });
}

async function updateVendor(req, res) {
  try {
    const data = req.body;
    const vendor = await AdminVendor.findById(req.params.id);
    if (!vendor) return res.status(404).render("errors/404");

    vendor.name = data.name;
    vendor.contactPerson = data.contactPerson || "";
    vendor.email = data.email || "";
    vendor.phone = data.phone || "";
    vendor.category = data.category || ADMIN_VENDOR_CATEGORY.OTHER;
    vendor.amcExpiry = data.amcExpiry ? new Date(data.amcExpiry) : undefined;
    vendor.status = data.status || ADMIN_VENDOR_STATUS.ACTIVE;
    vendor.notes = data.notes || "";
    await vendor.save();

    await logAudit({ user: req.user._id, action: "Update", entityType: "AdminVendor", entityId: vendor._id, details: "" });

    res.redirect("/admin/vendors?message=Vendor Updated Successfully");
  } catch (err) {
    res.status(400).render("admin-vendors/form", { editing: true, error: err.message, form: { _id: req.params.id, ...req.body }, ADMIN_VENDOR_CATEGORY, ADMIN_VENDOR_STATUS });
  }
}

module.exports = { listVendors, showNewForm, createVendor, showEditForm, updateVendor };
