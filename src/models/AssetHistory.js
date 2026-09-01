const mongoose = require("mongoose");

/**
 * Append-only log of assignment/status changes for an Asset — mirrors
 * the "Asset History" sheet's 6 columns (Date, Asset ID, Action, From,
 * To, Notes). assetId is the plain Asset.assetId string (e.g.
 * "AST-2026-000001"), not a Mongo ObjectId ref, matching the original
 * sheet's plain text link between the two sheets.
 */
const assetHistorySchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, index: true, trim: true },
    action: { type: String, required: true }, // "Created", "Issued", "Returned", ...
    from: { type: String, trim: true },
    to: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: "date", updatedAt: false } }
);

module.exports = mongoose.model("AssetHistory", assetHistorySchema);
