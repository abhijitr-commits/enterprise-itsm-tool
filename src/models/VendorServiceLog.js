const mongoose = require("mongoose");

/**
 * Port of the "Vendor Service Log" sheet (VendorServiceEngine.gs): Log
 * ID | Vendor | Issue | Priority | Status | Raised By | Raised Date |
 * Resolved Date. Tracks service issues raised against real vendors
 * (the Vendor collection) — a service log, not a duplicate vendor
 * directory.
 */
const vendorServiceLogSchema = new mongoose.Schema(
  {
    logId: { type: String, unique: true, index: true }, // VSVC-YYYY-000001

    vendor: { type: String, required: true, trim: true },
    issue: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["Normal", "High", "Critical"], default: "Normal" },
    status: { type: String, enum: ["Open", "Resolved"], default: "Open" },
    raisedBy: { type: String, trim: true },
    resolvedDate: { type: Date },
  },
  { timestamps: { createdAt: "raisedDate", updatedAt: false } }
);

module.exports = mongoose.model("VendorServiceLog", vendorServiceLogSchema);
