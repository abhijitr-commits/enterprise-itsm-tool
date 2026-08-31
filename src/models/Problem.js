const mongoose = require("mongoose");
const { STATUS, PRIORITY, ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");

const problemSchema = new mongoose.Schema(
  {
    problemId: { type: String, unique: true, index: true }, // PRB-00001

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    rootCause: { type: String, trim: true },
    workaround: { type: String, trim: true },
    isKnownError: { type: Boolean, default: false },

    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.MEDIUM },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN },

    linkedIncidents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Incident" }],

    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    resolvedAt: { type: Date },
    closedAt: { type: Date },

    comments: [commentSchema],
    history: [historyEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Problem", problemSchema);
module.exports.PREFIX = ID_PREFIX.PROBLEM;
