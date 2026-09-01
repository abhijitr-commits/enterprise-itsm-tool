/*************************************************************
 * sla.js — port of the business-hours-aware SLA calculator from
 * IncidentEngine.gs (calculateSLADue / addBusinessHours /
 * getHolidaySet). Same behavior: skips Saturdays, Sundays, and
 * any date in the Holidays collection when counting down the
 * SLA clock. The original cached holiday dates for 5 minutes
 * via CacheService; here a small in-process cache does the same
 * job without needing Redis for a single-instance deployment.
 *************************************************************/
const Holiday = require("../models/Holiday");
const SLAMatrix = require("../models/SLAMatrix");

let holidayCache = { dates: null, expiresAt: 0 };

async function getHolidaySet() {
  const now = Date.now();
  if (holidayCache.dates && now < holidayCache.expiresAt) {
    return holidayCache.dates;
  }

  const holidays = await Holiday.find({}, "date").lean();
  const dates = new Set(holidays.map((h) => toDateKey(h.date)));

  holidayCache = { dates, expiresAt: now + 5 * 60 * 1000 }; // 5 minutes, same as original
  return dates;
}

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Add N hours to a date, skipping Saturdays, Sundays, and holidays. */
async function addBusinessHours(startDate, hours) {
  const holidays = await getHolidaySet();

  let current = new Date(startDate.getTime());
  let remaining = hours;

  while (remaining > 0) {
    current = new Date(current.getTime() + 60 * 60 * 1000); // advance 1 hour
    const day = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateKey = toDateKey(current);

    if (day !== 0 && day !== 6 && !holidays.has(dateKey)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Reads resolution-time hours for a module+priority from the SLA Matrix
 * collection (falls back to 72h, same safety net as the original sheet
 * version) and returns the business-hours-aware due date.
 */
async function calculateSLADue(module, createdDate, priority) {
  const entry = await SLAMatrix.findOne({ module, priority });
  const hours = entry ? entry.resolutionTimeHours : 72;
  return addBusinessHours(createdDate, hours);
}

module.exports = { addBusinessHours, calculateSLADue, getHolidaySet };
