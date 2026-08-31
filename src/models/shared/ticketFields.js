const mongoose = require("mongoose");

/**
 * Shared building blocks reused by Incident, ServiceRequest, Problem and
 * Change — these four sheets ("registers") in the original tool all had
 * the same shape: a ticket header plus a running comment/audit trail.
 */

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true },
    isInternal: { type: Boolean, default: false }, // internal note vs. visible to requester
  },
  { timestamps: true }
);

const historyEntrySchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

module.exports = { commentSchema, historyEntrySchema };
