const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

const kbHistoryEntrySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    content: { type: String, required: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    editedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const knowledgeArticleSchema = new mongoose.Schema(
  {
    kbId: { type: String, unique: true, index: true }, // KB-00001
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    status: { type: String, enum: ["Draft", "Published", "Archived"], default: "Draft" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    version: { type: Number, default: 1 },
    priorVersions: [kbHistoryEntrySchema], // mirrors "KB History" sheet
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

knowledgeArticleSchema.index({ title: "text", content: "text", tags: "text" });

module.exports = mongoose.model("KnowledgeArticle", knowledgeArticleSchema);
module.exports.PREFIX = ID_PREFIX.KB;
