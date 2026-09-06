const mongoose = require("mongoose");

/**
 * Admin (Administration-department) facility helpdesk — same shape as
 * models/Complaint.js (the org-wide generic complaint book: complainant
 * / category / subject / description / status / assignedTo /
 * resolution), but a separate collection scoped to facility & office
 * services requests (housekeeping, pantry, seating, AC, courier, etc.)
 * so Administration's own queue and reporting never mix with the
 * general Complaints module other departments use. Any signed-in
 * employee can submit one; only the Admin team can triage/resolve —
 * see adminHelpdeskController.js.
 */
const ADMIN_COMPLAINT_STATUS = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed" };

const adminComplaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, unique: true, index: true }, // ADCOMP-YYYY-000001

    complainant: { type: String, required: true, trim: true },
    complainantEmail: { type: String, trim: true },
    department: { type: String, trim: true },
    category: { type: String, trim: true, default: "Facility" },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(ADMIN_COMPLAINT_STATUS), default: ADMIN_COMPLAINT_STATUS.OPEN },
    assignedTo: { type: String, trim: true },
    resolvedDate: { type: Date },
    resolutionNotes: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

module.exports = mongoose.model("AdminComplaint", adminComplaintSchema);
module.exports.ADMIN_COMPLAINT_STATUS = ADMIN_COMPLAINT_STATUS;
