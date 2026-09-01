/*************************************************************
 * permissions.js — direct port of Security.gs's
 * DEFAULT_PERMISSIONS_MAP. In the original tool this seeded a
 * "Permissions" sheet that admins could edit by hand; here it
 * seeds a Mongo collection (see models/Permission.js) that the
 * Admin Console can edit the same way, just as a small db write
 * instead of a spreadsheet edit.
 *************************************************************/
const { ROLE } = require("./constants");

const DEFAULT_PERMISSIONS_MAP = {
  // Incidents
  incidents_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  incidents_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  incidents_assign: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK],
  incidents_close: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  incidents_delete: [ROLE.ADMIN],

  // Service Requests
  requests_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  requests_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  requests_approve: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  requests_close: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],

  // Problems
  problems_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  problems_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  problems_close: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],

  // Changes
  changes_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  changes_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  changes_approve: [ROLE.ADMIN, ROLE.MANAGER],
  changes_close: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],

  // Assets
  assets_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  assets_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  assets_issue: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  assets_delete: [ROLE.ADMIN],

  // CMDB
  cmdb_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  cmdb_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  cmdb_delete: [ROLE.ADMIN],

  // Knowledge Base
  knowledge_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  knowledge_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],

  // Reports
  reports_view: [ROLE.ADMIN, ROLE.MANAGER],

  // Admin Console
  admin_manage_users: [ROLE.ADMIN],
  admin_manage_settings: [ROLE.ADMIN],
  admin_view_database: [ROLE.ADMIN],

  // --- Phase 4 (HR suite) ---
  // Employee Directory management, Onboarding/Offboarding automation, and
  // creating Performance Goals/Reviews are NOT in this map — same as the
  // original, they're gated by requireHRTeam() (Administrator, or Manager +
  // Department="HR") in src/utils/teamAccess.js instead of a per-role
  // permission, since those need a real HR person, not just any Manager.
  // Succession Planning (below) is the one exception in this family that
  // DOES use a Permission Matrix key — see its own comment for why.
  // See MIGRATION.md for which actions use which gate.

  // Resignations — any employee can submit their own
  resignation_submit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],

  // Leave (Phase 4B)
  leave_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  leave_approve: [ROLE.ADMIN, ROLE.MANAGER],

  // Attendance / Shift (Phase 4B)
  attendance_manage: [ROLE.ADMIN, ROLE.MANAGER],
  shifts_manage: [ROLE.ADMIN, ROLE.MANAGER],

  // Recruitment / ATS + Referrals (Phase 4C)
  recruitment_manage: [ROLE.ADMIN, ROLE.MANAGER],
  referrals_submit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  referrals_manage: [ROLE.ADMIN, ROLE.MANAGER],

  // Learning & Development / Succession (Phase 4D — PMS goals/reviews
  // stay requireHRTeam-gated like the original; LMS training assignment
  // uses this permission)
  training_manage: [ROLE.ADMIN, ROLE.MANAGER],

  // Succession Planning — genuinely sensitive HR data (who's a backup
  // for whom), Admin/Manager only. Bug fix vs. the original: every
  // function in SuccessionEngine.gs called requirePermission("view_reports"),
  // a key that was never actually defined anywhere in DEFAULT_PERMISSIONS_MAP
  // (the real key everywhere else is "reports_view") — so in the original,
  // hasPermission() always hit its "unknown permission key" fallback and
  // returned false for EVERYONE, including Administrators, meaning
  // Succession Planning was permanently inaccessible. This gives it its
  // own real key instead of silently reusing "reports_view" (which would
  // couple two unrelated features — unchecking Reports access for a
  // Manager shouldn't also lock them out of succession plans).
  succession_manage: [ROLE.ADMIN, ROLE.MANAGER],

  // Wellness & Engagement (Phase 4E)
  wellness_manage: [ROLE.ADMIN, ROLE.MANAGER],
  kudos_give: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],

  // --- Phase 5 (IT operations & facilities) ---
  // IT Helpdesk, Asset Allocation, and IT Clearance are NOT in this map —
  // same pattern as the HR suite, gated by requireITTeam() (Administrator,
  // or Manager + Department="IT") in teamAccess.js instead, since those
  // genuinely need an IT person. Access Requests submission is the one
  // "anyone logged in" exception (Phase 5A) — same tier as
  // resignation_submit/leave_create, matching the original's own comment
  // that it "reuses the anyone-logged-in permission tier."
  access_requests_submit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],

  // Vendors & Procurement (Phase 5B) — same tier as Assets: everyone can
  // create, Viewer can't edit. Vendor list/read has no key at all, same
  // as the original's getAllVendors() — reading a vendor directory needs
  // no special permission. Vendor Service Tracking and Requirement
  // Requests aren't in this map either — IT-team/Admin-team gated
  // (teamAccess.js) instead, matching the original's requireITTeam()/
  // isITTeam()-or-isAdminTeam() checks.
  vendors_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  vendors_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
  purchases_create: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
  purchases_edit: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER],
};

const ALL_ROLES_LIST = Object.values(ROLE);

module.exports = { DEFAULT_PERMISSIONS_MAP, ALL_ROLES_LIST };
