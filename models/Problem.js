const mongoose = require("mongoose");
const { STATUS, ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");

/**
 * Field-for-field port of the "Problem Register" sheet's 10 columns
 * (Problem ID, Created Date, Title, Description, Linked Incidents,
 * Root Cause, Known Error, Status, Owner, Closed Date) — same
 * plain-string approach as Incident.js/ServiceRequest.js.
 */
const problemSchema = new mongoose.Schema(
  {
    problemId: { type: String, unique: true, index: true }, // PRB-YYYY-000001

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    linkedIncidents: { type: String, trim: true }, // free-text list of incident IDs, as in the original sheet
    rootCause: { type: String, trim: true },
    knownError: { type: String, enum: ["Yes", "No"], default: "No" },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN },
    owner: { type: String, trim: true },

    closedDate: { type: Date },
    createdBy: { type: String, trim: true },

    comments: [commentSchema],
    history: [historyEntrySchema],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

problemSchema.index({ status: 1 });

module.exports = mongoose.model("Problem", problemSchema);
module.exports.PREFIX = ID_PREFIX.PROBLEM;
