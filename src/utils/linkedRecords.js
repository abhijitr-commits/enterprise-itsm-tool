/*************************************************************
 * linkedRecords.js — shared helper behind the audit backlog item
 * "Real ID links between Incidents, Problems, and Changes: these are
 * currently free-text strings, not references — so 'linked' records
 * don't actually navigate to each other."
 *
 * Every cross-module link field in this app (Problem.linkedIncidents,
 * the new Change.linkedProblemId/linkedIncidentIds, CMDB's
 * Dependencies) was originally recorded as a comma-separated list of
 * the OTHER record's own display ID (e.g. "INC-2026-000001,
 * INC-2026-000015") rather than a real Mongo reference — fine for
 * RECORDING a relationship, useless for actually navigating it. This
 * turns that same familiar comma-separated-ID text (still what the
 * form field looks like — no new UI concept to learn) into the real
 * ObjectIds behind it, tolerant of typos the same way the CMDB impact
 * analysis already is (cmdbController.js): an ID that doesn't match
 * anything just doesn't create a link, it never throws or blocks the
 * save.
 *************************************************************/

/** "INC-2026-000001, INC-2026-000015" -> ["INC-2026-000001", "INC-2026-000015"] */
function splitCodes(text) {
  return String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Resolve a comma-separated list of `codeField` values on `Model` to their real ObjectIds. */
async function resolveIdsByCode(Model, codeField, text) {
  const codes = splitCodes(text);
  if (!codes.length) return [];
  const found = await Model.find({ [codeField]: { $in: codes } }).select("_id").lean();
  return found.map((f) => f._id);
}

/** Resolve a single `codeField` value on `Model` to its real ObjectId, or null. */
async function resolveOneIdByCode(Model, codeField, text) {
  const code = String(text || "").trim();
  if (!code) return null;
  const found = await Model.findOne({ [codeField]: code }).select("_id").lean();
  return found ? found._id : null;
}

module.exports = { splitCodes, resolveIdsByCode, resolveOneIdByCode };
