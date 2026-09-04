const mongoose = require("mongoose");

/**
 * Port of the "Pre-Onboarding Details" sheet from
 * PreOnboardingDetailEngine.gs: Employee | Candidate Email |
 * Designation | Joining Date | BGV Vendor Email | BGV Status |
 * IT Provisioning Status | Welcome Kit Items (JSON). One row per
 * candidate, found-or-created by employee/candidate name — same
 * lookup key the Pre-Onboarding checklist itself already uses
 * (models/Checklist.js), so the two line up without needing a
 * shared foreign key.
 */
const WELCOME_KIT_ITEMS = [
  "Laptop/Workstation",
  "ID Card",
  "Access Card",
  "Welcome Letter",
  "Stationery Kit",
  "Company Handbook",
];

const BGV_STATUS = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", CLEARED: "Cleared", FLAGGED: "Flagged" };
const IT_PROVISIONING_STATUS = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };

const preOnboardingDetailSchema = new mongoose.Schema(
  {
    employee: { type: String, required: true, trim: true, unique: true },
    candidateEmail: { type: String, trim: true },
    designation: { type: String, trim: true },
    joiningDate: { type: Date },
    bgvVendorEmail: { type: String, trim: true },
    bgvStatus: { type: String, enum: Object.values(BGV_STATUS), default: BGV_STATUS.NOT_STARTED },
    itProvisioningStatus: { type: String, enum: Object.values(IT_PROVISIONING_STATUS), default: IT_PROVISIONING_STATUS.NOT_STARTED },
    welcomeKitItems: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PreOnboardingDetail", preOnboardingDetailSchema);
module.exports.WELCOME_KIT_ITEMS = WELCOME_KIT_ITEMS;
module.exports.BGV_STATUS = BGV_STATUS;
module.exports.IT_PROVISIONING_STATUS = IT_PROVISIONING_STATUS;
