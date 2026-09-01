/*************************************************************
 * shiftController.js — port of ShiftEngine.gs. Shift definitions
 * (Morning/Evening/Night, etc.) and a roster assigning employees to
 * shifts on specific dates. Reading shifts/roster is open to any
 * signed-in user (same as the original — only create/assign are
 * gated); "shifts_manage" is Admin/Manager by default.
 *************************************************************/
const Shift = require("../models/Shift");
const RosterEntry = require("../models/RosterEntry");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultWeekRange() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 6);
  return { startDate: toDateKey(start), endDate: toDateKey(end) };
}

async function showShiftsAndRoster(req, res) {
  const { startDate, endDate } = req.query.startDate && req.query.endDate ? req.query : defaultWeekRange();

  const [shifts, roster] = await Promise.all([
    Shift.find().sort({ shiftName: 1 }).lean(),
    RosterEntry.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1, employee: 1 }).lean(),
  ]);

  res.render("shifts/index", {
    shifts,
    roster,
    range: { startDate, endDate },
    message: req.query.message || null,
  });
}

async function createShift(req, res) {
  const data = req.body;
  if (!data.shiftName) {
    return res.redirect("/shifts?message=" + encodeURIComponent("Shift Name is required."));
  }

  const shiftId = await generateSequentialId("SHIFT");
  await Shift.create({ shiftId, shiftName: data.shiftName, startTime: data.startTime || "", endTime: data.endTime || "" });

  res.redirect("/shifts?message=" + encodeURIComponent("Shift Created Successfully"));
}

/**
 * Replaces any existing roster entry for this employee+date rather
 * than allowing two shifts on the same day — same rule as the
 * original's assignShift().
 */
async function assignShift(req, res) {
  try {
    const { employee, shiftId, date } = req.body;
    if (!employee) throw new Error("Employee is required.");
    if (!shiftId) throw new Error("Shift is required.");
    if (!date) throw new Error("Date is required.");

    const shift = await Shift.findOne({ shiftId });
    if (!shift) throw new Error("Shift not found.");

    const existing = await RosterEntry.findOne({ employee, date });
    if (existing) {
      existing.shiftId = shiftId;
      existing.shiftName = shift.shiftName;
      await existing.save();
    } else {
      const rosterId = await generateSequentialId("ROSTER");
      await RosterEntry.create({ rosterId, employee, shiftId, shiftName: shift.shiftName, date });
    }

    await logAudit({ user: req.user._id, action: "Assign", entityType: "Shift Roster", details: `${employee} -> ${shift.shiftName} on ${date}` });

    res.redirect(`/shifts?startDate=${req.body.rangeStart || ""}&endDate=${req.body.rangeEnd || ""}&message=${encodeURIComponent("Shift assigned successfully.")}`);
  } catch (err) {
    res.redirect("/shifts?message=" + encodeURIComponent(err.message));
  }
}

module.exports = { showShiftsAndRoster, createShift, assignShift };
