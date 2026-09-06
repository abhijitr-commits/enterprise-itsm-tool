const mongoose = require("mongoose");

/**
 * Admin (Administration-department) counterpart to models/Asset.js —
 * same shape (asset / serial / assigned-to / location / status /
 * purchase & warranty dates / vendor), but a separate collection
 * scoped to office & facility assets (furniture, office equipment,
 * pantry appliances, etc.) instead of IT hardware, so the two
 * registers and their warranty reports never mix. See
 * adminAssetController.js. No hardwareType/maintenance-schedule
 * fields — those exist on Asset.js for robotics hardware calibration,
 * which office furniture has no equivalent of.
 */
const ADMIN_ASSET_STATUS = {
  IN_SERVICE: "In Service",
  IN_STORAGE: "In Storage",
  MAINTENANCE: "Under Repair",
  DECOMMISSIONED: "Decommissioned",
};

const adminAssetSchema = new mongoose.Schema(
  {
    assetId: { type: String, unique: true, index: true }, // ADAST-YYYY-000001

    assetName: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    serialNumber: { type: String, trim: true },
    assignedTo: { type: String, trim: true },
    department: { type: String, trim: true, default: "Administration" },
    location: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(ADMIN_ASSET_STATUS), default: ADMIN_ASSET_STATUS.IN_SERVICE },
    purchaseDate: { type: Date },
    warrantyExpiry: { type: Date },
    vendor: { type: String, trim: true },
    remarks: { type: String, trim: true },

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

adminAssetSchema.index({ status: 1 });

module.exports = mongoose.model("AdminAsset", adminAssetSchema);
module.exports.ADMIN_ASSET_STATUS = ADMIN_ASSET_STATUS;
