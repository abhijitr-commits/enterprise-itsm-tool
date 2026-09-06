const mongoose = require("mongoose");

/**
 * Admin (Administration-department) counterpart to models/Vendor.js —
 * same shape (name / contact / AMC expiry / status), but a separate
 * collection scoped to facilities & office-services vendors instead of
 * IT hardware/software vendors, so the two directories and their AMC
 * expiry reports never mix. See adminVendorController.js.
 */
const ADMIN_VENDOR_CATEGORY = {
  HOUSEKEEPING: "Housekeeping",
  STATIONERY: "Stationery & Office Supplies",
  PANTRY: "Pantry / Cafeteria",
  FACILITY_MAINTENANCE: "Facility Maintenance",
  SECURITY: "Security Services",
  COURIER: "Courier & Logistics",
  AMC_CONTRACT: "AMC / Contract Services",
  OTHER: "Other",
};

const ADMIN_VENDOR_STATUS = { ACTIVE: "Active", INACTIVE: "Inactive" };

const adminVendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    category: { type: String, enum: Object.values(ADMIN_VENDOR_CATEGORY), default: ADMIN_VENDOR_CATEGORY.OTHER },
    amcExpiry: { type: Date },
    status: { type: String, enum: Object.values(ADMIN_VENDOR_STATUS), default: ADMIN_VENDOR_STATUS.ACTIVE },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminVendor", adminVendorSchema);
module.exports.ADMIN_VENDOR_CATEGORY = ADMIN_VENDOR_CATEGORY;
module.exports.ADMIN_VENDOR_STATUS = ADMIN_VENDOR_STATUS;
