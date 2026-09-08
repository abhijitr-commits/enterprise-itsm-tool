const mongoose = require("mongoose");
const { STATUS, ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");

/**
 * Field-for-field port of the "Service Requests" sheet's 10 columns
 * (Request ID, Created Date, Requester, Department, Catalog Item, Details,
 * Approver, Approval Status, Fulfillment Status, Closed Date) — same
 * plain-string approach as Incident.js so existing rows migrate 1:1.
 */
const APPROVAL = {
  PENDING: "Pending Approval",
  // Audit backlog — "Multi-level / conditional approval chains." A
  // catalog item with a secondApproverRole set (see RequestCatalog.js)
  // routes an Approved first decision here instead of straight to
  // APPROVED — the request sits in this state until a second, distinct
  // approver (in the required role) signs off. A catalog item with no
  // secondApproverRole never enters this state — today's single-level
  // behavior is unchanged.
  PENDING_SECOND: "Pending Second Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const serviceRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, index: true }, // REQ-YYYY-000001

    requester: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    catalogItem: { type: String, required: true, trim: true },
    details: { type: String, required: true, trim: true },

    approver: { type: String, trim: true }, // email of whoever made the first (or only) decision
    // Audit backlog — multi-level approval chains: the second, distinct
    // approver's email, only ever set when the catalog item's
    // secondApproverRole routed this request through a second step.
    secondApprover: { type: String, trim: true },
    approvalStatus: { type: String, enum: Object.values(APPROVAL), default: APPROVAL.PENDING },
    fulfillmentStatus: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN },

    closedDate: { type: Date },
    createdBy: { type: String, trim: true }, // email of whoever filed it

    comments: [commentSchema],
    history: [historyEntrySchema],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: true } }
);

serviceRequestSchema.index({ fulfillmentStatus: 1, approvalStatus: 1 });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
module.exports.PREFIX = ID_PREFIX.REQUEST;
module.exports.APPROVAL = APPROVAL;
