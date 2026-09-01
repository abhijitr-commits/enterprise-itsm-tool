const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Location", locationSchema);
