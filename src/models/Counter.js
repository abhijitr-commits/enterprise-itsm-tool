const mongoose = require("mongoose");

/** Backs sequential record IDs — one document per prefix (e.g. "INC", "REQ"). */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // the prefix itself, e.g. "INC"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

module.exports = { Counter };
