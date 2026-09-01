/*************************************************************
 * constants.js — central constants used across every module
 * (Node/MongoDB port of the original Apps Script Config.gs)
 *************************************************************/

const COMPANY_EMAIL_DOMAIN = process.env.COMPANY_EMAIL_DOMAIN || "peppermintrobotics.com";

/* ---------- STATUS VALUES ---------- */
const STATUS = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/* ---------- PRIORITY VALUES ---------- */
const PRIORITY = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

/* ---------- ID PREFIXES ---------- */
const ID_PREFIX = {
  INCIDENT: "INC",
  REQUEST: "REQ",
  PROBLEM: "PRB",
  CHANGE: "CHG",
  ASSET: "AST",
  CI: "CI",
  KB: "KB",
  EMPLOYEE: "EMP",
  LEAVE: "LV",
};

/* ---------- ROLES ---------- */
const ROLE = {
  ADMIN: "Administrator",
  SERVICE_DESK: "Service Desk",
  ENGINEER: "Engineer",
  MANAGER: "Manager",
  VIEWER: "Viewer",
};

/* ---------- LEAVE ----------
 * Port of LeaveEngine.gs's ANNUAL_LEAVE_QUOTA + the per-type defaults
 * getLeaveBalanceForType() falls back to. The original read these from
 * a "Settings" sheet an Admin could edit, with these numbers as the
 * fallback if a setting wasn't set yet; there's no generic Settings
 * screen here yet (see MIGRATION.md), so these are fixed constants for
 * now — genuinely adequate for a small company, same caveat the
 * original called out. */
const LEAVE_QUOTAS = {
  CASUAL: 18,
  SICK: 12,
  UNPAID: 30,
};

const LEAVE_TYPE = {
  CASUAL: "Casual Leave",
  SICK: "Sick Leave",
  EARNED: "Earned Leave",
  UNPAID: "Unpaid Leave",
};

module.exports = {
  COMPANY_EMAIL_DOMAIN,
  STATUS,
  PRIORITY,
  ID_PREFIX,
  ROLE,
  LEAVE_QUOTAS,
  LEAVE_TYPE,
};
