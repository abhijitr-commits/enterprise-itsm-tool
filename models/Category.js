const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    module: {
      type: String,
      enum: ["Incident", "Request", "Problem", "Change", "Asset"],
      required: true,
    },
    subCategory: { type: String, trim: true },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, module: 1, subCategory: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
