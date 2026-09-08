const mongoose = require("mongoose");
const { STATUS, PRIORITY, ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");

/**
 * Field-for-field port of the "Incident Register" sheet's 15 columns
 * (incidentID, createdDate, employeeName, department, location, category,
 * priority, subject, description, status, engineer, slaDue, closedDate,
 * remarks, createdBy) — kept as plain strings where the original sheet
 * stored free text (employeeName/department/location/category/engineer),
 * so existing rows migrate 1:1 without needing to resolve names to IDs
 * first. comments/history/attachments are new — the sheet had no
 * equivalent, but they're a natural upgrade over a single "remarks" cell.
 */
const incidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, unique: true, index: true }, // INC-YYYY-000001

    employeeName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.MEDIUM },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN },
    engineer: { type: String, trim: true }, // assigned engineer's display name
    // Task #102 (audit backlog) — real reference alongside the display
    // name above, resolved server-side whenever `engineer` matches a
    // real User account (see utils/userDirectory.js). Additive: legacy
    // and free-typed rows just leave this unset and keep working off
    // `engineer` exactly as before.
    engineerRef: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    slaDue: { type: Date },
    // Audit backlog addition — set the moment a breach on this incident is
    // sent to Slack/Teams by adminController.checkSlaBreaches(), so the
    // same breach is never alerted twice; cleared automatically the next
    // time this incident's status or slaDue actually changes (see
    // incidentController.updateIncident), so a re-opened or re-prioritized
    // ticket that breaches again gets a fresh alert instead of staying
    // silently suppressed forever.
    slaBreachNotifiedAt: { type: Date },
    closedDate: { type: Date },
    remarks: { type: String, trim: true },
    createdBy: { type: String, trim: true }, // email of whoever filed it

    // Phase 9 addition — no equivalent in the original sheet. Optional
    // free-text match against Asset.assetId/assetName (same
    // plain-string-link convention as every other cross-reference in
    // this app, e.g. Problem.linkedIncidents), so an Incident about a
    // specific robot unit or piece of equipment can be tied back to
    // its Asset Register entry for the Fleet Reliability report in
    // reportController.js.
    relatedAsset: { type: String, trim: true },

    // Task #103 (audit backlog) — Major Incident workflow. Deliberately
    // NOT a new module: a Major Incident is a regular Incident that gets
    // escalated handling (a Slack/Teams broadcast, a dedicated "war room"
    // board, a mandatory Post-Incident Review) — it isn't a different
    // kind of record. `isMajorIncident` stays true forever once declared
    // (so "was this ever a Major Incident" is always answerable for
    // reporting), independent of `status`; the active/stood-down state is
    // tracked separately below so a Major Incident can be stood down
    // (war room closed, situation stable) before the ticket itself is
    // Resolved/Closed.
    isMajorIncident: { type: Boolean, default: false },
    majorIncidentDeclaredAt: { type: Date },
    majorIncidentDeclaredBy: { type: String, trim: true }, // email
    majorIncidentStoodDownAt: { type: Date },
    majorIncidentStoodDownBy: { type: String, trim: true }, // email
    // Post-Incident Review — same free-text-fields-not-a-subform approach
    // as Change.rootCause/correctiveAction/lessonsLearned for a rolled-
    // back change. Only meaningful once isMajorIncident is true, but not
    // schema-enforced to that.
    pirNotes: { type: String, trim: true },

    comments: [commentSchema],
    history: [historyEntrySchema],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

incidentSchema.index({ status: 1, priority: 1 });
incidentSchema.index({ engineer: 1, status: 1 });
incidentSchema.index({ engineerRef: 1, status: 1 });
incidentSchema.index({ isMajorIncident: 1, majorIncidentStoodDownAt: 1 });

module.exports = mongoose.model("Incident", incidentSchema);
module.exports.PREFIX = ID_PREFIX.INCIDENT;
