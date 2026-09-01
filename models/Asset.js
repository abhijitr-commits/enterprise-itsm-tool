const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

/**
 * Field-for-field port of the "Asset Register" sheet's 11 columns
 * (Asset ID, Asset Name, Type, Serial Number, Assigned To, Department,
 * Location, Status, Purchase Date, Warranty Expiry, Vendor).
 *
 * Phase 9 additions (`hardwareType` + the four maintenance fields)
 * are new — the original Asset Register had no equivalent. They exist
 * so this same register can also track robotics hardware (robot
 * units, sensors, actuators, controllers, batteries) that needs
 * periodic calibration/maintenance the way IT equipment generally
 * doesn't — see assetController.js's `logMaintenance()`. All four
 * default to values that make an existing IT-equipment row (from
 * before this phase) behave exactly as before: `hardwareType`
 * defaults to "IT Equipment" and the rest stay unset/optional.
 */
const ASSET_STATUS = {
  IN_SERVICE: "In Service",
  IN_STORAGE: "In Storage",
  MAINTENANCE: "Under Repair",
  DECOMMISSIONED: "Decommissioned",
};

const HARDWARE_TYPE = {
  IT_EQUIPMENT: "IT Equipment",
  ROBOT_UNIT: "Robot Unit",
  SENSOR: "Sensor",
  ACTUATOR: "Actuator",
  CONTROLLER: "Controller",
  BATTERY: "Battery",
  OTHER: "Other",
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

    hardwareType: { type: String, enum: Object.values(HARDWARE_TYPE), default: HARDWARE_TYPE.IT_EQUIPMENT },
    maintenanceIntervalDays: { type: Number }, // e.g. 90 — calibration/service cadence; unset = no schedule
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDue: { type: Date }, // computed on each logMaintenance() call, not hand-edited

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

assetSchema.index({ status: 1, department: 1 });
assetSchema.index({ nextMaintenanceDue: 1 });

module.exports = mongoose.model("Asset", assetSchema);
module.exports.PREFIX = ID_PREFIX.ASSET;
module.exports.ASSET_STATUS = ASSET_STATUS;
module.exports.HARDWARE_TYPE = HARDWARE_TYPE;
