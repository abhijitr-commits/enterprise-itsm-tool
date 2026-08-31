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

module.exports = {
  COMPANY_EMAIL_DOMAIN,
  STATUS,
  PRIORITY,
  ID_PREFIX,
  ROLE,
};
