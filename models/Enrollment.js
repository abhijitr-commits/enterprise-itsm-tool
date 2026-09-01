const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Training Enrollments" sheet (LMSEngine.gs):
 * Enrollment ID | Employee | Course ID | Course Title | Enrollment Date |
 * Status | Completion Date | Score/Notes. courseTitle is denormalized
 * alongside courseId, same pattern as Candidate.jobTitle, so a row still
 * reads correctly even if the course is edited later.
 */
const ENROLLMENT_STATUS = { ENROLLED: "Enrolled", COMPLETED: "Completed", WITHDRAWN: "Withdrawn" };

const enrollmentSchema = new mongoose.Schema(
  {
    enrollmentId: { type: String, unique: true, index: true }, // ENR-YYYY-000001
    employee: { type: String, required: true, trim: true },
    courseId: { type: String, required: true, trim: true },
    courseTitle: { type: String, trim: true },
    status: { type: String, enum: Object.values(ENROLLMENT_STATUS), default: ENROLLMENT_STATUS.ENROLLED },
    completionDate: { type: Date },
    scoreNotes: { type: String, trim: true },
  },
  { timestamps: { createdAt: "enrollmentDate", updatedAt: true } }
);

enrollmentSchema.index({ employee: 1 });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
module.exports.ENROLLMENT_STATUS = ENROLLMENT_STATUS;
