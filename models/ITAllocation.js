const mongoose = require("mongoose");

/**
 * Port of the "IT Asset Allocations" sheet (ITAssetAllocationEngine.gs):
 * Allocation ID | Employee | Department | Designation | Asset IDs |
 * Allocation Date | Allocated By | Notes.
 *
 * A real allocation record, not a checkbox pretending something
 * happened — creating one of these always follows actually calling
 * issueAssetInternal() (see assetController.js) against the real Asset
 * Register for every asset ID listed here, so the asset genuinely
 * becomes assigned, with full Asset History logging already built into
 * assetController.js.
 */
const itAllocationSchema = new mongoose.Schema(
  {
    allocationId: { type: String, unique: true, index: true }, // ALLOC-YYYY-000001

    employee: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    assetIds: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    allocatedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "allocationDate", updatedAt: false } }
);

module.exports = mongoose.model("ITAllocation", itAllocationSchema);
