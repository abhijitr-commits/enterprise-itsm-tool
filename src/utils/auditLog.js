const AuditLog = require("../models/AuditLog");

/** Port of logAudit() from Common.gs — never let an audit-log failure break the actual action. */
async function logAudit({ user, action, entityType, entityId, details, ipAddress }) {
  try {
    await AuditLog.create({ user, action, entityType, entityId, details, ipAddress });
  } catch (err) {
    console.error("[auditLog] failed:", err.message);
  }
}

module.exports = { logAudit };
