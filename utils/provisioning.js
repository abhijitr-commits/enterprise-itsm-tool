/*************************************************************
 * provisioning.js — port of provisionUserAccess()/deactivateUserAccess()
 * from AutomationEngine.gs, adapted for this app's login model.
 *
 * The original could create a login with no password at all, because
 * identity came from Google Sign-In (Apps Script ran under the
 * organization's Google Workspace) — a Users sheet row was enough to
 * grant access. This app authenticates with email + password instead
 * (see MIGRATION.md — no Google Workspace / SSO dependency, keeps
 * everything free and self-contained), so provisioning a login here
 * means generating a one-time temporary password, same idea as the
 * auto-seed Administrator account server.js creates on first boot.
 * Whoever created the Employee record sees that password ONCE, in a
 * flash message, and is expected to pass it on securely — there's no
 * email provider yet (see MIGRATION.md) to send it automatically.
 *************************************************************/
const crypto = require("crypto");
const User = require("../models/User");
const { ROLE } = require("../config/constants");
const { logAudit } = require("./auditLog");

function generateTempPassword() {
  // 10 url-safe characters — short enough to read off a screen, long
  // enough to not be guessable.
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

/**
 * Creates a login (default role: Viewer — same as the original) if one
 * doesn't already exist for this email. Returns the temporary password
 * ONLY when a new login was actually created, so the caller can show it
 * once; returns null if a login already existed (nothing to show) or if
 * there's no email on file to provision against.
 */
async function provisionUserAccess({ name, email, department }, actorId) {
  if (!email) return null;

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) return null;

  const tempPassword = generateTempPassword();

  const user = new User({ name, email, department: department || "", role: ROLE.VIEWER, active: true });
  await user.setPassword(tempPassword);
  await user.save();

  await logAudit({
    user: actorId,
    action: "Auto-Provisioned",
    entityType: "User",
    entityId: user._id,
    details: "Role: Viewer (default)",
  });

  return tempPassword;
}

/**
 * Deactivates the login matching this employee's email (falls back to
 * matching by name, same as the original which only had a name to key
 * on) — sets active=false without touching role/history, so an Admin
 * can flip it back on for a rehire.
 */
async function deactivateUserAccess({ name, email }, actorId) {
  const query = email ? { email: String(email).toLowerCase().trim() } : { name };
  const user = await User.findOne(query);
  if (!user) return false;

  user.active = false;
  await user.save();

  await logAudit({
    user: actorId,
    action: "Auto-Deactivated",
    entityType: "User",
    entityId: user._id,
    details: "Employee status: Left",
  });

  return true;
}

module.exports = { provisionUserAccess, deactivateUserAccess };
