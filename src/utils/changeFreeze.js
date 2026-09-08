/*************************************************************
 * changeFreeze.js — shared helper behind the Change freeze-window
 * conflict check. Kept separate from changeController so the same
 * "is this date frozen?" logic can be reused by the calendar view
 * without either one importing the other.
 *************************************************************/
const ChangeFreezeWindow = require("../models/ChangeFreezeWindow");

/**
 * Returns the freeze window (plain object) covering the given date, or
 * null if none does. Freeze windows are declared by calendar date (an
 * Admin picks a start day and an end day on the Master Data form), so
 * the comparison is whole-day: a plannedDate of any time on a covered
 * day counts as inside the window.
 */
async function findFreezeWindowFor(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return ChangeFreezeWindow.findOne({
    startDate: { $lte: dayEnd },
    endDate: { $gte: dayStart },
  })
    .sort({ startDate: 1 })
    .lean();
}

/** All freeze windows that overlap [rangeStart, rangeEnd] at all — used by the calendar view to shade a whole month in one query. */
async function findFreezeWindowsInRange(rangeStart, rangeEnd) {
  return ChangeFreezeWindow.find({
    startDate: { $lte: rangeEnd },
    endDate: { $gte: rangeStart },
  })
    .sort({ startDate: 1 })
    .lean();
}

module.exports = { findFreezeWindowFor, findFreezeWindowsInRange };
