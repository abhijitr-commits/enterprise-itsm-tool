const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

const assetSchema = new mongoose.Schema(
  {
    assetId: { type: String, unique: true, index: true }, // AST-00001
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true }, // Laptop, Monitor, Software License, etc.
    serialNumber: { type: String, trim: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    purchaseDate: { type: Date },
    warrantyExpiry: { type: Date },
    cost: { type: Number },
    status: {
      type: String,
      enum: ["In Stock", "Assigned", "In Repair", "Retired", "Lost"],
      default: "In Stock",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Asset", assetSchema);
module.exports.PREFIX = ID_PREFIX.ASSET;
