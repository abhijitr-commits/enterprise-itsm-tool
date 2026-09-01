const mongoose = require("mongoose");

/** Field-for-field port of the "Kudos" sheet (WellnessEngine.gs): Kudos ID | From | To | Message | Date. Peer-to-peer recognition wall, visible to everyone. */
const kudosSchema = new mongoose.Schema(
  {
    kudosId: { type: String, unique: true, index: true }, // KUDOS-YYYY-000001
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: "date", updatedAt: false } }
);

module.exports = mongoose.model("Kudos", kudosSchema);
