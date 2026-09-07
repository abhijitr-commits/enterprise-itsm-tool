/*************************************************************
 * csvController.js — the generic export/import engine behind every
 * module's "Export CSV" / "Import CSV" buttons (partials/csvActions.ejs).
 * One controller + one route pair (see routes/csvRoutes.js) serves every
 * module in utils/csvRegistry.js, keyed by :moduleKey — there is no
 * per-module export/import code to maintain as new modules are added,
 * only a new registry entry.
 *
 * A few deliberate safety choices, worth calling out:
 *  - User (login accounts) is registered export-only: passwordHash is
 *    never a CSV column (excluded in csvRegistry's column generation),
 *    and bulk-creating logins via CSV would mean either putting
 *    plaintext passwords in a spreadsheet or creating accounts with no
 *    usable password — neither is acceptable, so new users still go
 *    through the existing Admin Console "Add User" form.
 *  - Append-only logs (AuditLog, AssetHistory, StockTransaction,
 *    AdminStockTransaction) and generated documents (Certificate) are
 *    export-only — importing into them would let a CSV silently
 *    rewrite history.
 *  - Import NEVER overwrites an existing record: a row whose idField
 *    matches something already in the database is skipped and counted,
 *    never merged/updated. This is the safest of the two options
 *    discussed with the user (create-new-only) — re-uploading a
 *    previous export to add a handful of new rows is safe by
 *    construction, since every existing row is simply skipped.
 *  - Import is gated per-module (utils/csvRegistry.js's importTeam),
 *    always at least as strict as that module's own read access, and
 *    always requires sign-in (routes/csvRoutes.js applies requireLogin).
 *************************************************************/
const { registry, AUTO_MANAGED_FIELDS } = require("../utils/csvRegistry");
const { csvUiMeta } = require("../utils/csvMeta");
const { rowsToCSV, csvTextToRecords, coerceCell, setNested } = require("../utils/csvHelper");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { canExportModule, canImportModule, resolveCsvExportAccess, resolveCsvImportAccess } = require("../utils/csvAccess");

function withMessage(url, message, extra) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}message=${encodeURIComponent(message)}${extra || ""}`;
}

function safeRedirectTarget(req) {
  // Referer is always this module's own list page in normal use (the
  // form/link both live on that page) — falling back to the module's
  // hub-less root is just a safety net if a request ever arrives with no
  // Referer at all (e.g. a bookmarked POST, which browsers don't do, but
  // better than crashing).
  return req.get("Referer") || "/";
}

/**
 * showHub — the central "Data Import/Export" page: one screen where the
 * user picks a source module to export FROM and a destination module to
 * import INTO, instead of having to hunt down each module's own list page
 * for its Export/Import buttons. Pure UI convenience over the exact same
 * engine/permissions every per-module button already uses — no new
 * capability, just one more (and more discoverable) way to reach it.
 */
async function showHub(req, res) {
  const [exportAccess, importAccess] = await Promise.all([
    resolveCsvExportAccess(req.user),
    resolveCsvImportAccess(req.user),
  ]);

  const exportable = [];
  const importable = [];
  for (const [key, meta] of Object.entries(csvUiMeta)) {
    if (exportAccess[key]) exportable.push({ key, label: meta.label });
    if (meta.importable && importAccess[key]) importable.push({ key, label: meta.label });
  }
  exportable.sort((a, b) => a.label.localeCompare(b.label));
  importable.sort((a, b) => a.label.localeCompare(b.label));

  res.render("csv/hub", { exportable, importable, message: req.query.message || null });
}

async function exportModule(req, res) {
  const mod = registry[req.params.moduleKey];
  if (!mod) return res.status(404).render("errors/404");

  if (!(await canExportModule(mod, req.user))) return res.status(403).render("errors/403", { action: `Export ${mod.label}` });

  const items = await mod.model.find().lean();
  const csv = rowsToCSV(items, mod.columns);
  const filename = `${mod.label.replace(/[^A-Za-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

async function importModule(req, res) {
  const mod = registry[req.params.moduleKey];
  if (!mod) return res.status(404).render("errors/404");
  const redirectTarget = safeRedirectTarget(req);

  if (!mod.importable) {
    return res.status(403).render("errors/403", { action: `Import into ${mod.label} (export-only module)` });
  }
  if (!(await canImportModule(mod, req.user))) return res.status(403).render("errors/403", { action: `Import ${mod.label}` });

  if (!req.file) return res.redirect(withMessage(redirectTarget, "Choose a CSV file to import."));

  let records;
  try {
    records = csvTextToRecords(req.file.buffer.toString("utf8"));
  } catch (err) {
    return res.redirect(withMessage(redirectTarget, `Could not read that file as CSV: ${err.message}`));
  }

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const rowNum = i + 2; // header is row 1
    const rec = records[i];
    try {
      const providedId = (rec[mod.idField] || "").trim();
      if (providedId) {
        const existing = await mod.model.findOne({ [mod.idField]: providedId }).lean();
        if (existing) { skipped++; continue; }
      }

      const doc = {};
      let rowError = null;
      for (const col of mod.columns) {
        if (col.key === mod.idField) continue; // handled separately below
        if (AUTO_MANAGED_FIELDS.has(col.key)) continue; // Mongoose sets these itself
        const result = coerceCell(rec[col.key], col);
        if (!result.ok) { rowError = result.error; break; }
        if (result.value !== undefined) setNested(doc, col.key, result.value);
      }
      if (rowError) { errors.push(`Row ${rowNum}: ${rowError}`); continue; }

      if (mod.idPrefix) {
        // Generated-ID model: always mint a fresh ID, even if the file
        // supplied one (e.g. from a previous export) — never take an
        // arbitrary caller-supplied value for these.
        doc[mod.idField] = await generateSequentialId(mod.idPrefix);
      } else if (providedId) {
        doc[mod.idField] = providedId;
      } else {
        errors.push(`Row ${rowNum}: "${mod.idField}" is required`);
        continue;
      }

      await mod.model.create(doc);
      created++;
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  await logAudit({
    user: req.user._id,
    action: "CSV Import",
    entityType: mod.modelName,
    details: `${created} created, ${skipped} skipped, ${errors.length} error(s)`,
  });

  const shown = errors.slice(0, 5);
  const moreCount = errors.length - shown.length;
  let summary = `CSV import finished: ${created} row(s) created, ${skipped} skipped (already existed).`;
  if (errors.length) {
    summary += ` ${errors.length} row(s) had errors: ${shown.join(" | ")}`;
    if (moreCount > 0) summary += ` (+${moreCount} more)`;
  }

  res.redirect(withMessage(redirectTarget, summary));
}

module.exports = { showHub, exportModule, importModule };
