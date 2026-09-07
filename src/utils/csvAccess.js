/*************************************************************
 * csvAccess.js — shared export/import permission resolution for the
 * generic CSV engine, used by BOTH csvController.js (the real
 * enforcement, at request time) and middleware/auth.js (which
 * precomputes res.locals.csvCanImport once per request so
 * partials/csvActions.ejs can decide whether to show an Import button
 * without needing its own copy of this logic, or a template-side await
 * — EJS can't await a Promise mid-render).
 *
 * See utils/csvRegistry.js's header comment for the full reasoning
 * behind the null-defaults (export defaults open, import defaults
 * Administrator-only).
 *************************************************************/
const { isHRTeam, isITTeam, isAdminTeam } = require("./teamAccess");
const { hasPermission } = require("./permissions");
const { ROLE } = require("../config/constants");
const { csvUiMeta } = require("./csvMeta");

function teamCheck(teamKey, user) {
  if (teamKey === "hr") return isHRTeam(user);
  if (teamKey === "it") return isITTeam(user);
  if (teamKey === "admin") return isAdminTeam(user);
  return false;
}

async function canExportModule(meta, user) {
  if (!user) return false;
  if (meta.exportTeam) return teamCheck(meta.exportTeam, user);
  if (meta.exportPermission) return (await hasPermission(user.role, meta.exportPermission)) || user.role === ROLE.ADMIN;
  return true; // no gate beyond being signed in — matches this app's "reads aren't gated" convention
}

async function canImportModule(meta, user) {
  if (!user || !meta.importable) return false;
  if (meta.importTeam) return teamCheck(meta.importTeam, user);
  if (meta.importPermission) return (await hasPermission(user.role, meta.importPermission)) || user.role === ROLE.ADMIN;
  return user.role === ROLE.ADMIN; // no gate found to mirror -> Administrator-only, not open
}

/** One pass over every registered module, resolving whether the given
 * user may import into each — used to attach res.locals.csvCanImport.
 * Cheap: hasPermission() caches the whole Permission map in-process for
 * 60s, so this is Array/Object lookups after the first call warms it. */
async function resolveCsvImportAccess(user) {
  const access = {};
  if (!user) return access;
  await Promise.all(
    Object.entries(csvUiMeta).map(async ([key, meta]) => {
      access[key] = await canImportModule(meta, user);
    })
  );
  return access;
}

/** Same idea as resolveCsvImportAccess, but for export — used by the
 * "Data Import/Export" hub page (csvController.js's showHub) to build
 * the "export from" dropdown out of only the modules this user can
 * actually read, rather than listing all 73 and letting most of them
 * 403 on click. */
async function resolveCsvExportAccess(user) {
  const access = {};
  if (!user) return access;
  await Promise.all(
    Object.entries(csvUiMeta).map(async ([key, meta]) => {
      access[key] = await canExportModule(meta, user);
    })
  );
  return access;
}

module.exports = { teamCheck, canExportModule, canImportModule, resolveCsvImportAccess, resolveCsvExportAccess };
