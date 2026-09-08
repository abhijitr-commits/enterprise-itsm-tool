const mongoose = require("mongoose");

/**
 * Task #101 (audit backlog) — typed CMDB relationships.
 *
 * The CMDB's original `dependencies` field on ConfigurationItem (see that
 * model's doc comment) is a free-text, comma-separated list of CI IDs —
 * fine for a quick "these are related" note, but it can't say HOW two CIs
 * relate (does this server host that app, or merely depend on it?), and
 * cmdbController's impact-analysis traversal has to treat every edge the
 * same because of it.
 *
 * This is purely additive: a new collection of directed, typed edges
 * between two ConfigurationItems. The legacy `dependencies` text field is
 * untouched and keeps working exactly as before — buildCiGraph() (in
 * cmdbController) merges both sources into one graph, tagging legacy
 * free-text edges with type "Related (legacy)" so existing data is never
 * silently dropped from impact analysis or the graph view.
 */
const RELATIONSHIP_TYPES = ["Depends On", "Hosted On", "Connects To", "Part Of", "Backup For"];

const ciRelationshipSchema = new mongoose.Schema(
  {
    source: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigurationItem", required: true, index: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigurationItem", required: true, index: true },
    type: { type: String, enum: RELATIONSHIP_TYPES, default: "Depends On" },
    notes: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

const CIRelationship = mongoose.model("CIRelationship", ciRelationshipSchema);
module.exports = CIRelationship;
module.exports.RELATIONSHIP_TYPES = RELATIONSHIP_TYPES;
