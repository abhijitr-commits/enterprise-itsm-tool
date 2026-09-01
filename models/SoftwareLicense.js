const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Software Licenses" sheet
 * (SoftwareLicenseEngine.gs): License ID | Software Name | Vendor |
 * License Type | Seats Total | Seats Used | Cost | Purchase Date |
 * Expiry Date | Status. Tracks software licenses separately from
 * hardware (Asset Register) — seats total/used, expiry, cost, vendor —
 * feeding into the same proactive expiry alert system as contracts,
 * warranties, and vendor AMCs.
 */
const softwareLicenseSchema = new mongoose.Schema(
  {
    licenseId: { type: String, unique: true, index: true }, // LIC-YYYY-000001

    softwareName: { type: String, required: true, trim: true },
    vendor: { type: String, trim: true },
    licenseType: { type: String, trim: true },
    seatsTotal: { type: Number, default: 0 },
    seatsUsed: { type: Number, default: 0 },
    cost: { type: Number },
    purchaseDate: { type: Date },
    expiryDate: { type: Date },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SoftwareLicense", softwareLicenseSchema);
