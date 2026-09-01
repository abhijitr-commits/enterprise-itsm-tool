/*************************************************************
 * teamAccess.js — port of the isHRTeam()/isITTeam()/isAdminTeam()
 * family from Security.gs. This is the OTHER half of the
 * original's access model, alongside the action->role Permission
 * Matrix (utils/permissions.js): some areas aren't gated by "can
 * this ROLE do this action" but by "does this person actually
 * work in that team" — Department AND Role together, not just
 * Role alone. An Administrator always overrides every check here
 * (system-wide access), matching the original exactly.
 *
 * - HR team  = Administrator, OR (Manager AND Department = "HR")
 *     Gates: Employee Directory management, Onboarding/Offboarding
 *     automation, Performance Management, Succession Planning.
 * - IT team  = Administrator, OR (Manager AND Department = "IT")
 *     Gates: IT Asset Allocation, IT Clearance (Phase 5).
 * - Admin team = Administrator, OR (Manager AND Department = "Administration")
 *     Gates: the operational side of Admin Console (Master Data
 *     etc.) — User Management/Permission Matrix/Database Viewer
 *     stay Administrator-only regardless (see adminRoutes.js,
 *     unchanged from Phase 3 — this module doesn't loosen those).
 *
 * Directory READS (e.g. the employee list) are deliberately NOT
 * gated by any of these — same as the original, where
 * getAllEmployees() has no permission check at all, because a
 * company directory lookup is a normal thing for anyone signed in
 * to do. Only writes (create/update/import/onboarding automation)
 * require the matching team.
 *************************************************************/
const { ROLE } = require("../config/constants");

function departmentIs(user, name) {
  return String(user.department || "").trim().toLowerCase() === name.toLowerCase();
}

function isHRTeam(user) {
  if (!user) return false;
  if (user.role === ROLE.ADMIN) return true;
  return user.role === ROLE.MANAGER && departmentIs(user, "HR");
}

function isITTeam(user) {
  if (!user) return false;
  if (user.role === ROLE.ADMIN) return true;
  return user.role === ROLE.MANAGER && departmentIs(user, "IT");
}

function isAdminTeam(user) {
  if (!user) return false;
  if (user.role === ROLE.ADMIN) return true;
  return user.role === ROLE.MANAGER && departmentIs(user, "Administration");
}

/** Express middleware factory — same 403 style as guard()/requirePermission(). */
function requireTeam(checkFn, label) {
  return (req, res, next) => {
    if (!checkFn(req.user)) {
      return res.status(403).render("errors/403", { action: `${label} team only` });
    }
    next();
  };
}

module.exports = {
  isHRTeam,
  isITTeam,
  isAdminTeam,
  requireHRTeam: requireTeam(isHRTeam, "HR"),
  requireITTeam: requireTeam(isITTeam, "IT"),
  requireAdminTeam: requireTeam(isAdminTeam, "Admin"),
};
