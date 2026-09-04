const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Vendors" sheet (VendorEngine.gs):
 * Vendor Name | Contact Person | Email | Phone | Category | AMC Expiry
 * | Status.
 *
 * Replaces an earlier placeholder schema (name/address/active) that was
 * scaffolded before VendorEngine.gs had been ported and never wired to
 * a controller — see MIGRATION.md's Phase 5A note. Nothing referenced
 * the old fields, so this is a clean rebuild against the real columns.
 */
const VENDOR_CATEGORY = {
  HARDWARE: "Hardware",
  SOFTWARE: "Software",
  NETWORKING: "Networking",
  MAINTENANCE_AMC: "Maintenance/AMC",
  OTHER: "Other",
};

const VENDOR_STATUS = { ACTIVE: "Active", INACTIVE: "Inactive" };

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    category: { type: String, enum: Object.values(VENDOR_CATEGORY), default: VENDOR_CATEGORY.OTHER },
    amcExpiry: { type: Date },
    status: { type: String, enum: Object.values(VENDOR_STATUS), default: VENDOR_STATUS.ACTIVE },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
module.exports.VENDOR_CATEGORY = VENDOR_CATEGORY;
module.exports.VENDOR_STATUS = VENDOR_STATUS;
