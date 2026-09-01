const mongoose = require("mongoose");
const { PRIORITY } = require("../config/constants");

/**
 * Defines response/resolution targets (in hours) per priority, per module —
 * mirrors the "SLA Matrix" sheet.
 */
const slaMatrixSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: ["Incident", "Request", "Problem", "Change"],
      required: true,
    },
    priority: { type: String, enum: Object.values(PRIORITY), required: true },
    responseTimeHours: { type: Number, required: true },
    resolutionTimeHours: { type: Number, required: true },
  },
  { timestamps: true }
);

slaMatrixSchema.index({ module: 1, priority: 1 }, { unique: true });

module.exports = mongoose.model("SLAMatrix", slaMatrixSchema);
