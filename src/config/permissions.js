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
  // Employee Directory management, Onboarding/Offboarding automation,
  // Performance Management, and Succession Planning are NOT in this map —
  // same as the original, they're gated by requireHRTeam() (Administrator,
  // or Manager + Department="HR") in src/utils/teamAccess.js instead of a
  // per-role permission, since those need a real HR person, not just any
  // Manager. See MIGRATION.md for which actions use which gate.

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

  // Learning & Development / Succession (Phase 4D — PMS/Succession stay
  // requireHRTeam-gated like the original; LMS training assignment uses
  // this permission)
  training_manage: [ROLE.ADMIN, ROLE.MANAGER],

  // Wellness & Engagement (Phase 4E)
  wellness_manage: [ROLE.ADMIN, ROLE.MANAGER],
  kudos_give: [ROLE.ADMIN, ROLE.MANAGER, ROLE.SERVICE_DESK, ROLE.ENGINEER, ROLE.VIEWER],
};

const ALL_ROLES_LIST = Object.values(ROLE);

module.exports = { DEFAULT_PERMISSIONS_MAP, ALL_ROLES_LIST };
