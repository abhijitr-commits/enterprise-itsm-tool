const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

/**
 * Field-for-field port of the "CMDB" sheet's 9 columns (CI ID, CI Name,
 * Type, IP Address, Owner, Status, Dependencies, VLAN, Subnet).
 * Dependencies stays free-text (comma-separated CI IDs), same
 * plain-text-link trade-off the original used, matching Problem's
 * Linked Incidents field.
 */
const ciSchema = new mongoose.Schema(
  {
    ciId: { type: String, unique: true, index: true }, // CI-YYYY-000001

    ciName: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true }, // Server, Application, Database, Network Gear, ...
    ipAddress: { type: String, trim: true },
    owner: { type: String, trim: true },
    status: { type: String, enum: ["Active", "Inactive", "Decommissioned"], default: "Active" },
    dependencies: { type: String, trim: true }, // comma-separated CI IDs
    vlan: { type: String, trim: true },
    subnet: { type: String, trim: true },

    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

module.exports = mongoose.model("ConfigurationItem", ciSchema);
module.exports.PREFIX = ID_PREFIX.CI;
