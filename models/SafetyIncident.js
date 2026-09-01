const mongoose = require("mongoose");

/**
 * Phase 9 addition — no equivalent in the original 116-file project,
 * which only had a generic Complaint module (ComplaintEngine.gs).
 * Built for a robotics company specifically: physical safety events
 * around moving equipment (near-misses, minor injuries, equipment
 * that behaved unexpectedly) need severity/injury tracking a general
 * "AC not working"-style complaint doesn't capture, and management
 * genuinely wants near-miss frequency as its own metric, not folded
 * into IT/facilities complaint counts. Modeled directly on
 * Complaint.js's shape and lifecycle (open submit tier, Admin/Manager
 * manage tier) rather than inventing a new pattern.
 */
const SAFETY_SEVERITY = { NEAR_MISS: "Near Miss", MINOR: "Minor", MODERATE: "Moderate", SEVERE: "Severe" };
const SAFETY_STATUS = { OPEN: "Open", UNDER_INVESTIGATION: "Under Investigation", CLOSED: "Closed" };

const safetyIncidentSchema = new mongoose.Schema(
  {
    safetyIncidentId: { type: String, unique: true, index: true }, // SAF-YYYY-000001

    reporter: { type: String, required: true, trim: true },
    reporterEmail: { type: String, trim: true },
    department: { type: String, trim: true },
    location: { type: String, trim: true },
    severity: { type: String, enum: Object.values(SAFETY_SEVERITY), default: SAFETY_SEVERITY.NEAR_MISS },
    injuryInvolved: { type: Boolean, default: false },
    relatedAsset: { type: String, trim: true }, // optional — the robot/equipment involved, same plain-string link as Incident.relatedAsset

    description: { type: String, required: true, trim: true },
    immediateActionTaken: { type: String, trim: true },
    correctiveAction: { type: String, trim: true },

    status: { type: String, enum: Object.values(SAFETY_STATUS), default: SAFETY_STATUS.OPEN },
    assignedTo: { type: String, trim: true },
    closedDate: { type: Date },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

safetyIncidentSchema.index({ status: 1, severity: 1 });

module.exports = mongoose.model("SafetyIncident", safetyIncidentSchema);
module.exports.SAFETY_SEVERITY = SAFETY_SEVERITY;
module.exports.SAFETY_STATUS = SAFETY_STATUS;
