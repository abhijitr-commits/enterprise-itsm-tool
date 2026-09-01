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

    slaDue: { type: Date },
    closedDate: { type: Date },
    remarks: { type: String, trim: true },
    createdBy: { type: String, trim: true }, // email of whoever filed it

    comments: [commentSchema],
    history: [historyEntrySchema],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

incidentSchema.index({ status: 1, priority: 1 });
incidentSchema.index({ engineer: 1, status: 1 });

module.exports = mongoose.model("Incident", incidentSchema);
module.exports.PREFIX = ID_PREFIX.INCIDENT;
