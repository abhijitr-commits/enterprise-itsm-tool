const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Resignations" sheet (OnboardingEngine.gs):
 * Resignation ID | Employee | Department | Resignation Date | Last
 * Working Day | Notice Period (Days) | Reason | Status | IT/Finance/HR/
 * Manager/Admin Clearance | Exit Interview Notes.
 */
const CLEARANCE_STATUS = { PENDING: "Pending", CLEARED: "Cleared" };
const RESIGNATION_STATUS = { SUBMITTED: "Submitted", COMPLETED: "Completed" };

const resignationSchema = new mongoose.Schema(
  {
    resignationId: { type: String, unique: true, index: true }, // RES-YYYY-000001

    employee: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    resignationDate: { type: Date, required: true },
    lastWorkingDay: { type: Date, required: true },
    noticePeriodDays: { type: Number },
    reason: { type: String, trim: true },
    status: { type: String, enum: Object.values(RESIGNATION_STATUS), default: RESIGNATION_STATUS.SUBMITTED },

    clearances: {
      it: { type: String, enum: Object.values(CLEARANCE_STATUS), default: CLEARANCE_STATUS.PENDING },
      finance: { type: String, enum: Object.values(CLEARANCE_STATUS), default: CLEARANCE_STATUS.PENDING },
      hr: { type: String, enum: Object.values(CLEARANCE_STATUS), default: CLEARANCE_STATUS.PENDING },
      manager: { type: String, enum: Object.values(CLEARANCE_STATUS), default: CLEARANCE_STATUS.PENDING },
      admin: { type: String, enum: Object.values(CLEARANCE_STATUS), default: CLEARANCE_STATUS.PENDING },
    },

    exitInterviewNotes: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

module.exports = mongoose.model("Resignation", resignationSchema);
module.exports.CLEARANCE_STATUS = CLEARANCE_STATUS;
module.exports.RESIGNATION_STATUS = RESIGNATION_STATUS;
