const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Benefits Enrollment" sheet
 * (BenefitsEngine.gs): Enrollment ID | Employee | Benefit Type |
 * Plan Name | Coverage Details | Enrollment Date | Status | Enrolled By.
 * Tracks WHO is enrolled in WHAT plan — not a claims processing system,
 * same scope note as the original.
 */
const BENEFIT_STATUS = { ACTIVE: "Active", INACTIVE: "Inactive" };

const benefitEnrollmentSchema = new mongoose.Schema(
  {
    enrollmentId: { type: String, unique: true, index: true }, // BEN-YYYY-000001
    employee: { type: String, required: true, trim: true },
    benefitType: { type: String, required: true, trim: true }, // e.g. "Health Insurance"
    planName: { type: String, required: true, trim: true },
    coverageDetails: { type: String, trim: true },
    status: { type: String, enum: Object.values(BENEFIT_STATUS), default: BENEFIT_STATUS.ACTIVE },
    enrolledBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "enrollmentDate", updatedAt: true } }
);

benefitEnrollmentSchema.index({ employee: 1 });

module.exports = mongoose.model("BenefitEnrollment", benefitEnrollmentSchema);
module.exports.BENEFIT_STATUS = BENEFIT_STATUS;
