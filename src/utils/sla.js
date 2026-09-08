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
const { STATUS } = require("../config/constants");

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

/**
 * Audit backlog item: "SLA due dates are calculated, but nothing
 * actively flags or escalates a ticket once it breaches — it's a
 * passive field today, not a trigger." This is the single shared
 * definition of what "Breached"/"At Risk"/"On Track"/"Met" means for a
 * ticket, so the live badge on the Incident list/detail pages, the
 * Reports page's SLA Compliance report, and the SLA breach alert
 * (adminController.checkSlaBreaches) can never quietly drift apart —
 * previously this exact logic was only inline inside
 * reportController.js's slaComplianceReport().
 */
function slaStatusOf(doc, now = new Date()) {
  const slaDue = doc.slaDue ? new Date(doc.slaDue) : null;
  const closedDate = doc.closedDate ? new Date(doc.closedDate) : null;
  const isTerminal = doc.status === STATUS.CLOSED || doc.status === STATUS.RESOLVED;

  if (isTerminal) {
    return slaDue && closedDate ? (closedDate <= slaDue ? "Met" : "Breached") : "Met";
  }
  if (!slaDue) return "On Track";

  const hoursRemaining = (slaDue.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursRemaining < 0) return "Breached";
  if (hoursRemaining <= 4) return "At Risk";
  return "On Track";
}

module.exports = { addBusinessHours, calculateSLADue, getHolidaySet, slaStatusOf };
