const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

/**
 * Field-for-field port of the "Asset Register" sheet's 11 columns
 * (Asset ID, Asset Name, Type, Serial Number, Assigned To, Department,
 * Location, Status, Purchase Date, Warranty Expiry, Vendor).
 */
const ASSET_STATUS = {
  IN_SERVICE: "In Service",
  IN_STORAGE: "In Storage",
  MAINTENANCE: "Under Repair",
  DECOMMISSIONED: "Decommissioned",
};

const assetSchema = new mongoose.Schema(
  {
    assetId: { type: String, unique: true, index: true }, // AST-YYYY-000001

    assetName: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    serialNumber: { type: String, trim: true },
    assignedTo: { type: String, trim: true }, // employee display name, blank if unassigned
    department: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(ASSET_STATUS), default: ASSET_STATUS.IN_STORAGE },
    purchaseDate: { type: Date },
    warrantyExpiry: { type: Date },
    vendor: { type: String, trim: true },

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

assetSchema.index({ status: 1, department: 1 });

module.exports = mongoose.model("Asset", assetSchema);
module.exports.PREFIX = ID_PREFIX.ASSET;
module.exports.ASSET_STATUS = ASSET_STATUS;
