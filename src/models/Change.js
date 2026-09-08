const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");
const { APPROVAL } = require("./ServiceRequest"); // CAB status reuses the same Pending/Approved/Rejected values

/**
 * Field-for-field port of the "Change Register" sheet's 12 columns
 * (Change ID, Created Date, Title, Description, Risk Level, CAB Status,
 * Planned Date, Implementation Status, PIR Notes, Closed Date,
 * Requested By, Department).
 */
const IMPL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  IMPLEMENTED: "Implemented",
  ROLLED_BACK: "Rolled Back",
};

const changeSchema = new mongoose.Schema(
  {
    changeId: { type: String, unique: true, index: true }, // CHG-YYYY-000001

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    riskLevel: { type: String, enum: ["Low", "Medium", "High"], required: true },
    cabStatus: { type: String, enum: Object.values(APPROVAL), default: APPROVAL.PENDING },
    plannedDate: { type: Date, required: true },
    implementationStatus: { type: String, enum: Object.values(IMPL), default: IMPL.NOT_STARTED },
    pirNotes: { type: String, trim: true },

    // Captured when an approved change's implementation is rolled back
    // (see changeController.updateImplementationStatus) — a failed
    // change isn't just marked "Rolled Back" and forgotten: the person
    // closing it out has to record why it failed, what was done about
    // it right away, and what the team should remember next time. All
    // three are shown together on the change record and are searchable
    // (module search + global search) so a future CAB reviewing a
    // similar change can find this one.
    rootCause: { type: String, trim: true },
    correctiveAction: { type: String, trim: true },
    lessonsLearned: { type: String, trim: true },

    closedDate: { type: Date },
    requestedBy: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },

    // Audit backlog addition — no equivalent in the original sheet. A
    // Change often exists BECAUSE of a Problem's root cause, and may
    // also be raised directly against one or more Incidents; both are
    // real references (see utils/linkedRecords.js), resolved from a
    // plain "type the ID" form field the same way Problem.linkedIncidentIds
    // is, so CAB can click straight through to the Problem/Incidents that
    // justify this change instead of hunting for them by title.
    linkedProblemId: { type: mongoose.Schema.Types.ObjectId, ref: "Problem" },
    linkedIncidentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Incident" }],

    createdBy: { type: String, trim: true },

    comments: [commentSchema],
    history: [historyEntrySchema],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

changeSchema.index({ cabStatus: 1, implementationStatus: 1 });

module.exports = mongoose.model("Change", changeSchema);
module.exports.PREFIX = ID_PREFIX.CHANGE;
module.exports.IMPL = IMPL;
