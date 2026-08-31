const mongoose = require("mongoose");

/** Append-only log of assignment/status changes for an Asset — mirrors "Asset History" sheet. */
const assetHistorySchema = new mongoose.Schema(
  {
    asset: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    action: { type: String, required: true }, // "Assigned", "Returned", "Repaired", "Retired", ...
    fromEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    toEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssetHistory", assetHistorySchema);
