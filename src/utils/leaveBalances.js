/*************************************************************
 * leaveBalances.js — port of the balance-calculation half of
 * LeaveEngine.gs (getLeaveBalanceForType / getEarnedLeaveBalance /
 * getAllLeaveBalancesSafe). Quota-per-type is a fixed constant here
 * (config/constants.js's LEAVE_QUOTAS) rather than a Settings-sheet
 * lookup — see that file's comment for why.
 *************************************************************/
const LeaveRequest = require("../models/LeaveRequest");
const Attendance = require("../models/Attendance");
const RosterEntry = require("../models/RosterEntry");
const { getHolidaySet } = require("./sla");
const { LEAVE_TYPE, LEAVE_QUOTAS } = require("../config/constants");
const { APPROVAL } = require("../models/ServiceRequest");

async function balanceForType(employeeName, leaveType, quota) {
  const currentYear = new Date().getFullYear();

  const approved = await LeaveRequest.find({
    employee: new RegExp(`^${employeeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    leaveType,
    status: APPROVAL.APPROVED,
  }).lean();

  const used = approved
    .filter((l) => new Date(l.fromDate).getFullYear() === currentYear)
    .reduce((sum, l) => sum + Number(l.days || 0), 0);

  return { quota, used, remaining: quota - used };
}

/**
 * Earned Leave balance — NOT a fixed quota. Credits accrue from actual
 * attendance, but ONLY for a day that's genuinely unscheduled extra
 * work: the employee checked in AND it was a weekend/holiday AND they
 * weren't actually rostered to work that date (so a normal "alternate
 * Saturday" shift earns nothing — only an unrostered weekend/holiday
 * they still worked counts).
 */
async function earnedLeaveBalance(employeeName) {
  const nameRx = new RegExp(`^${employeeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  const [holidays, attendanceRecords, rosterEntries, usedApproved] = await Promise.all([
    getHolidaySet(),
    Attendance.find({ employee: nameRx, checkIn: { $ne: null } }).lean(),
    RosterEntry.find({ employee: nameRx }).lean(),
    LeaveRequest.find({ employee: nameRx, leaveType: LEAVE_TYPE.EARNED, status: APPROVAL.APPROVED }).lean(),
  ]);

  const rosteredDates = new Set(rosterEntries.map((r) => r.date));

  let earnedCredits = 0;
  for (const a of attendanceRecords) {
    const d = new Date(a.date);
    const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || holidays.has(a.date);
    const wasRostered = rosteredDates.has(a.date);
    if (isWeekendOrHoliday && !wasRostered) earnedCredits++;
  }

  const used = usedApproved.reduce((sum, l) => sum + Number(l.days || 0), 0);

  return { earned: earnedCredits, used, remaining: earnedCredits - used };
}

/** All four balances at once, for My Profile. */
async function getAllLeaveBalances(employeeName) {
  const [casual, medical, earned, unpaid] = await Promise.all([
    balanceForType(employeeName, LEAVE_TYPE.CASUAL, LEAVE_QUOTAS.CASUAL),
    balanceForType(employeeName, LEAVE_TYPE.SICK, LEAVE_QUOTAS.SICK),
    earnedLeaveBalance(employeeName),
    balanceForType(employeeName, LEAVE_TYPE.UNPAID, LEAVE_QUOTAS.UNPAID),
  ]);

  return { casual, medical, earned, unpaid };
}

module.exports = { getAllLeaveBalances };
