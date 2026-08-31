const mongoose = require("mongoose");
const { STATUS, PRIORITY, ID_PREFIX } = require("../config/constants");
const { commentSchema, historyEntrySchema } = require("./shared/ticketFields");

const changeSchema = new mongoose.Schema(
  {
    changeId: { type: String, unique: true, index: true }, // CHG-00001

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    changeType: { type: String, enum: ["Standard", "Normal", "Emergency"], default: "Normal" },
    riskLevel: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },

    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.MEDIUM },
    status: {
      type: String,
      enum: [...Object.values(STATUS), "Pending Approval", "Scheduled"],
      default: "Pending Approval",
    },

    plannedStart: { type: Date },
    plannedEnd: { type: Date },
    actualStart: { type: Date },
    actualEnd: { type: Date },
    rollbackPlan: { type: String, trim: true },

    linkedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: "Problem" }],
    affectedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Asset" }],
    affectedCIs: [{ type: mongoose.Schema.Types.ObjectId, ref: "ConfigurationItem" }],

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    implementedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    comments: [commentSchema],
    history: [historyEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Change", changeSchema);
module.exports.PREFIX = ID_PREFIX.CHANGE;
