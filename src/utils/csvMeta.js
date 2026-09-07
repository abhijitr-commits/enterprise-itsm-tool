/*************************************************************
 * csvMeta.js — lightweight, model-free view of csvRegistryData.json for
 * partials/csvActions.ejs (and anywhere else a template just needs to
 * know "does this module have CSV export/import, and who can import").
 * Deliberately does NOT require csvRegistry.js (which requires every
 * Mongoose model) — this file is attached to res.locals on every single
 * request (see middleware/auth.js), so it stays a plain, cheap object.
 *************************************************************/
const data = require("./csvRegistryData.json");

const csvUiMeta = {};
for (const [key, entry] of Object.entries(data)) {
  csvUiMeta[key] = {
    label: entry.label,
    importable: entry.importable,
    exportTeam: entry.exportTeam, // 'hr' | 'it' | 'admin' | null (open to any signed-in user)
    exportPermission: entry.exportPermission, // guard() action string, or null
    importTeam: entry.importTeam, // 'hr' | 'it' | 'admin' | null
    importPermission: entry.importPermission, // guard() action string, or null (both null => Administrator only)
  };
}

module.exports = { csvUiMeta };
