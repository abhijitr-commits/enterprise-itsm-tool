const mongoose = require("mongoose");

/**
 * Port of the "IT Clearance Records" sheet (ITClearanceEngine.gs):
 * Clearance ID | Resignation ID | Employee | Assets Returned | Access
 * Revoked | Accounts Deactivated | Data Backup Completed | Notes |
 * Completed Date | Completed By.
 *
 * A real clearance workflow for resignees — the assets listed here
 * were actually returned via returnAssetInternal() (assetController.js),
 * genuinely updating the Asset Register + Asset History, not just a
 * free-text checklist. See itClearanceController.js for the rule that
 * the parent Resignation's IT clearance is only marked "Cleared" once
 * all three booleans below are true.
 */
const itClearanceRecordSchema = new mongoose.Schema(
  {
    clearanceId: { type: String, unique: true, index: true }, // ITCLR-YYYY-000001

    resignationId: { type: String, required: true, trim: true, index: true },
    employee: { type: String, required: true, trim: true },
    assetsReturned: [{ type: String, trim: true }],
    accessRevoked: { type: Boolean, default: false },
    accountsDeactivated: { type: Boolean, default: false },
    dataBackupCompleted: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    completedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "completedDate", updatedAt: false } }
);

module.exports = mongoose.model("ITClearanceRecord", itClearanceRecordSchema);
