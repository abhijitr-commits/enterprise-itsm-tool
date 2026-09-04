/*************************************************************
 * delegation.js — port of Security.gs's isDelegatedApprover(),
 * deferred out of Phase 4B (the "Delegate To" field on a Leave
 * request has been captured and stored since then, but nothing
 * server-side read it — see MIGRATION.md).
 *
 * If a Manager/Admin is on APPROVED leave today and named someone
 * as their delegate, that delegate temporarily gets the SAME
 * approval rights the person on leave has — but only for
 * changes_approve / leave_approve / requests_approve, matching the
 * original exactly. Nothing else (admin_manage_users,
 * admin_manage_settings, admin_view_database, any *_delete action)
 * can ever be delegated, and delegation can never grant MORE than
 * the person on leave actually had themselves — if their own role
 * doesn't carry the permission, standing in for them doesn't
 * manufacture it.
 *
 * This is checked ADDITIONALLY to the normal Permission Matrix
 * check (hasPermission(role, action)), not as a replacement for
 * it — see the guard()/canApprove call sites in leaveRoutes.js /
 * requestRoutes.js / changeRoutes.js / leaveController.js /
 * myWorkController.js. `hasPermission()` itself is left untouched
 * (still a pure role→allowed lookup) since it's called in many
 * places with just a role string, not a full user — e.g.
 * moduleVisibility.js precomputes nav visibility per role in the
 * abstract, with no actual signed-in person to delegate for.
 *************************************************************/
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const { APPROVAL } = require("../models/ServiceRequest");
const { getPermissionsMap } = require("./permissions");

const DELEGATABLE_ACTIONS = ["changes_approve", "leave_approve", "requests_approve"];

function todayAtMidnightUTC() {
  // Date-only comparison, same granularity as the original's
  // yyyy-MM-dd string comparison — fromDate/toDate are stored as
  // UTC-midnight Date objects (parsed from a plain "YYYY-MM-DD"
  // form field), so this lines up with them exactly.
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function isDelegatedApprover(user, action) {
  if (!user || DELEGATABLE_ACTIONS.indexOf(action) === -1) return false;

  const myName = String(user.name || "").trim().toLowerCase();
  if (!myName) return false;

  const today = todayAtMidnightUTC();

  const activeDelegations = await LeaveRequest.find({
    status: APPROVAL.APPROVED,
    fromDate: { $lte: today },
    toDate: { $gte: today },
  }).lean();

  const delegatedToMe = activeDelegations.filter(
    (l) => String(l.delegateTo || "").trim().toLowerCase() === myName
  );

  if (delegatedToMe.length === 0) return false;

  const map = await getPermissionsMap();
  const allowedRoles = map[action] || [];

  for (const leave of delegatedToMe) {
    // Only meaningful if the person on leave actually HAD this
    // permission themselves — delegation can't grant MORE than the
    // original approver had.
    const employeeUser = await User.findOne({
      name: new RegExp(`^${String(leave.employee).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    }).lean();

    if (employeeUser && allowedRoles.includes(employeeUser.role)) return true;
  }

  return false;
}

module.exports = { isDelegatedApprover, DELEGATABLE_ACTIONS };
