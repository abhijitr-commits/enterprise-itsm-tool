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
    closedDate: { type: Date },
    requestedBy: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },

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
