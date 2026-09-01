const mongoose = require("mongoose");
const { ID_PREFIX } = require("../config/constants");

/**
 * Field-for-field port of the "Knowledge Base" sheet's 7 columns
 * (Article ID, Title, Category, Content, Author, Last Updated, Status)
 * plus the "KB History" sheet (Article ID, Version, Title, Category,
 * Content, Author, Version Date) — embedded here as `priorVersions`
 * instead of a second collection, since it's always looked up by
 * article. Every edit snapshots the about-to-be-replaced version here
 * first, exactly like the original's updateArticle().
 */
const kbHistoryEntrySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    title: { type: String, required: true },
    category: { type: String },
    content: { type: String, required: true },
    author: { type: String },
    versionDate: { type: Date, default: Date.now },
  },
  { _id: false }
);

const knowledgeArticleSchema = new mongoose.Schema(
  {
    articleId: { type: String, unique: true, index: true }, // KB-YYYY-000001

    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "Other" },
    content: { type: String, required: true },
    author: { type: String, trim: true }, // email of whoever last saved it
    status: { type: String, enum: ["Draft", "Published", "Archived"], default: "Published" },

    priorVersions: [kbHistoryEntrySchema],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "lastUpdated" } }
);

knowledgeArticleSchema.index({ title: "text", content: "text", category: "text" });

module.exports = mongoose.model("KnowledgeArticle", knowledgeArticleSchema);
module.exports.PREFIX = ID_PREFIX.KB;
