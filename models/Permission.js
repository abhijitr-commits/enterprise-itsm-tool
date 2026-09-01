const mongoose = require("mongoose");
const { ALL_ROLES_LIST } = require("../config/permissions");

/**
 * Mongo equivalent of the original "Permissions" sheet: one document per
 * action, with a boolean per role. Admins can flip these from the Admin
 * Console without a code deploy — same idea as editing the sheet, just a
 * database write instead.
 */
const permissionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, unique: true },
    allowedRoles: [{ type: String, enum: ALL_ROLES_LIST }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
