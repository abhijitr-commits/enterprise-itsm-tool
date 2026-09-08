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
    // Audit backlog addition — real references alongside the legacy
    // free-text field above (kept as-is for old data, search, and the
    // Integration API's existing "linkedIncidents" body field). Both are
    // written from the same form input by problemController.js, via
    // utils/linkedRecords.js, so a linked Incident is now something you
    // can actually click through to instead of just a string that
    // happens to look like an Incident ID.
    linkedIncidentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Incident" }],
    rootCause: { type: String, trim: true },
    knownError: { type: String, enum: ["Yes", "No"], default: "No" },
    // Audit backlog — "Known Error Database (KEDB) for Problem
    // Management." rootCause is the permanent-fix analysis; workaround is
    // the separate, deliberately different thing a KEDB actually exists
    // for — a temporary mitigation a Service Desk agent can hand a user
    // (or apply themselves) against a NEW incident right now, while the
    // real fix behind rootCause is still pending. Only meaningful once
    // knownError is "Yes", but not schema-enforced to that (a Problem can
    // record a workaround before formally being marked a Known Error).
    // Read by problemController.listKnownErrors (the KEDB view) and
    // utils/knownErrors.js's suggestKnownErrorsFor (surfaced on the
    // Incident detail page).
    workaround: { type: String, trim: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN },
    owner: { type: String, trim: true },
    // Task #102 (audit backlog) — real reference alongside `owner`,
    // resolved server-side when the typed name matches a User exactly
    // (see utils/userDirectory.js). Additive — see Incident.engineerRef's
    // doc comment for the full rationale, same pattern here.
    ownerRef: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

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
