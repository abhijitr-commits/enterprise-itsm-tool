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
};

const ALL_ROLES_LIST = Object.values(ROLE);

module.exports = { DEFAULT_PERMISSIONS_MAP, ALL_ROLES_LIST };
