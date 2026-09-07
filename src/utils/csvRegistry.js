/*************************************************************
 * csvRegistry.js — the module registry for the generic CSV
 * export/import engine (csvController.js / csvRoutes.js). Every entry
 * describes one Mongoose model in flat-CSV terms:
 *
 *   modelName   - file under src/models/ to require
 *   label       - human label used in headings and the CSV filename
 *   columns     - [{key, type, required, enum}] — reference (ObjectId)
 *                 fields, embedded sub-document arrays (the
 *                 comments/history/attachments thread on ticket
 *                 modules), and binary fields are deliberately excluded
 *                 everywhere: they aren't flat-CSV-representable. A
 *                 dotted key (e.g. "clearances.it") is a real nested
 *                 field — csvHelper's getNested/setNested handle it.
 *   idField     - the field used to detect "this row already exists"
 *                 on import: either a generated sequential ID
 *                 (idPrefix set) or a natural key (idPrefix null —
 *                 email/name/date/key/action/employee).
 *   idPrefix    - generateSequentialId() prefix for generated-ID
 *                 models; null for natural-key models.
 *   importable  - false for append-only logs, generated documents
 *                 (Certificate), and User (see the note in
 *                 csvController.js for why login accounts are
 *                 deliberately export-only).
 *   exportTeam / exportPermission - who can export. null on BOTH means
 *                 open to any signed-in user, matching this app's
 *                 "reads aren't gated" convention — that is the common
 *                 case. When one module's own list route requires
 *                 requireHRTeam/ITTeam/AdminTeam, exportTeam mirrors
 *                 that ('hr'|'it'|'admin'); when it requires a
 *                 fine-grained guard("some_action") instead,
 *                 exportPermission carries that exact action string,
 *                 checked via hasPermission(role, action) — same check
 *                 that route already makes. A module never has both set.
 *   importTeam / importPermission - who can bulk-import, same shape as
 *                 the export pair. Unlike export, null on BOTH means
 *                 Administrator-only, not "open" — bulk import is more
 *                 consequential than a read, so every module gets SOME
 *                 gate even where the read itself is wide open. The
 *                 rule applied when generating these: reuse the export
 *                 gate if the module has one; otherwise mirror that
 *                 module's own real create-route gate; otherwise (a
 *                 genuinely open create form) fall back to
 *                 Administrator-only, since a CSV can set fields
 *                 (status, dates, assignments...) a single-record
 *                 submit form never exposes.
 *
 * The data below (columns/idField/idPrefix/team+permission assignments)
 * was generated from a runtime schema dump plus a hand-curated set of
 * overrides grepped from every routes/*.js file — see
 * gen_csv_registry.js (dev-only, not part of the running app) if this
 * ever needs regenerating after a model or route gate changes.
 *************************************************************/
const data = require("./csvRegistryData.json");

const registry = {};
for (const [key, entry] of Object.entries(data)) {
  registry[key] = { ...entry, model: require(`../models/${entry.modelName}`) };
}

/** Fields Mongoose (or this app's own convention) manages automatically
 * and that CSV import must never set directly, even if the column is
 * present in an uploaded file (e.g. re-importing a previous export). */
const AUTO_MANAGED_FIELDS = new Set(["createdAt", "updatedAt", "createdDate", "lastUpdated"]);

module.exports = { registry, AUTO_MANAGED_FIELDS };
