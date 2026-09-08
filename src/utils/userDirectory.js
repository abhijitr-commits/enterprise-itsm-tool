/*************************************************************
 * userDirectory.js — task #102 (audit backlog): "engineer" /
 * "assignedTo" / "owner" fields on Incident, Problem, WorkOrder,
 * Complaint, AdminComplaint and SafetyIncident have always been
 * plain trimmed strings (see each model's own doc comment) — fine
 * for display, but it means two real gaps:
 *
 *   1. myWorkController's "My Tickets" panel (and any future
 *      "assigned to me" view) can only match by regex against
 *      req.user.name, so a login rename, a typo, or a title suffix
 *      someone typed into the field ("Sam Support (L2)") silently
 *      drops a ticket out of that person's queue.
 *   2. The assignee field is a bare free-text input today — nothing
 *      stops it from being assigned to someone who left the company
 *      or was never a real account, and nothing links from the
 *      ticket to that person's role.
 *
 * The fix here is additive, same philosophy as every other schema
 * change this session: each model keeps its existing free-text
 * field exactly as-is (still what's shown, still what CSV
 * export/import round-trips, still tolerant of a custom name that
 * matches no account), and gains a SIBLING `*Ref` ObjectId field
 * pointing at the real User document when the typed name matches
 * one — resolved transparently on every create/update via
 * resolveAssigneeRef() below. Old records without a match just keep
 * their Ref unset, exactly like before this change existed.
 *************************************************************/
const User = require("../models/User");
const { resolveRecipient } = require("./notifications");

let assignableCache = { users: [], expiresAt: 0 };

/**
 * Every active User, for the assignee `<input list="...">` suggestion —
 * same "suggestion, not a hard constraint" pattern as departmentList/
 * employeeList in middleware/auth.js (see its own comment for why: a
 * 60s-stale name here is harmless, and the field still takes free text
 * either way). Deliberately every role, not just Engineer/Service Desk —
 * plenty of small teams have a Manager or even an Administrator pick up
 * a ticket directly.
 */
async function getAssignableUsers() {
  if (Date.now() < assignableCache.expiresAt) return assignableCache.users;
  const rows = await User.find({ active: true }).sort({ name: 1 }).select("name email role").lean();
  assignableCache = { users: rows, expiresAt: Date.now() + 60000 };
  return assignableCache.users;
}

/**
 * Case-insensitive EXACT match of a typed assignee name against the
 * User collection — reuses utils/notifications.js's resolveRecipient
 * (the same lookup notifyUser has always done internally to find who
 * to notify) rather than a second copy of the same logic. Returns null
 * on no match OR on an ambiguous match (two active Users sharing a
 * display name) — a wrong Ref would be worse than an unresolved one,
 * since the plain-text field is still there and still correct either way.
 */
async function resolveAssigneeRef(name) {
  return resolveRecipient({ name });
}

module.exports = { getAssignableUsers, resolveAssigneeRef };
