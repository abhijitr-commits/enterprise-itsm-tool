const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Complaints" sheet (ComplaintEngine.gs):
 * Complaint ID | Complainant | Complainant Email | Department |
 * Category | Subject | Description | Status | Assigned To | Created
 * Date | Resolved Date | Resolution Notes.
 *
 * Generic complaint booking — deliberately NOT category-locked (unlike
 * Incident Management, which is IT-specific). Anyone can submit any
 * kind of complaint (facilities, behavior, HR, general grievance,
 * etc.); see complaintController.js for the routing/status lifecycle.
 */
const COMPLAINT_STATUS = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed" };

const complaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, unique: true, index: true }, // COMP-YYYY-000001

    complainant: { type: String, required: true, trim: true },
    complainantEmail: { type: String, trim: true },
    department: { type: String, trim: true },
    category: { type: String, trim: true, default: "General" },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(COMPLAINT_STATUS), default: COMPLAINT_STATUS.OPEN },
    assignedTo: { type: String, trim: true },
    resolvedDate: { type: Date },
    resolutionNotes: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

module.exports = mongoose.model("Complaint", complaintSchema);
module.exports.COMPLAINT_STATUS = COMPLAINT_STATUS;
