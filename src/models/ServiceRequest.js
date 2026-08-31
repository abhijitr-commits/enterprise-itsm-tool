const mongoose = require("mongoose");
const { STATUS, PRIORITY, ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");

const serviceRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, index: true }, // REQ-00001

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.MEDIUM },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },

    approvalRequired: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["Not Required", "Pending", "Approved", "Rejected"],
      default: "Not Required",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    responseDueAt: { type: Date },
    resolutionDueAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    slaBreached: { type: Boolean, default: false },

    comments: [commentSchema],
    history: [historyEntrySchema],
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: true }
);

serviceRequestSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
module.exports.PREFIX = ID_PREFIX.REQUEST;
