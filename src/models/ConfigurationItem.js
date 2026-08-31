const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

/** CMDB entry — a logical/technical configuration item (server, application, service, ...). */
const ciSchema = new mongoose.Schema(
  {
    ciId: { type: String, unique: true, index: true }, // CI-00001
    name: { type: String, required: true, trim: true },
    type: { type: String, trim: true }, // Server, Application, Database, Network Device, ...
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    status: { type: String, enum: ["Active", "Inactive", "Decommissioned"], default: "Active" },
    relatedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Asset" }],
    dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: "ConfigurationItem" }],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConfigurationItem", ciSchema);
module.exports.PREFIX = ID_PREFIX.CI;
