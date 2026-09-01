/*************************************************************
 * checklists.js — shared helper behind the four checklist types
 * (see models/Checklist.js). Port of createOnboardingChecklistInternal()
 * / createOffboardingChecklistInternal() / createAdminOnboardingChecklistInternal()
 * / createAdminOffboardingChecklistInternal() from OnboardingEngine.gs,
 * collapsed into one function since all four did the same thing against
 * a different sheet.
 *************************************************************/
const ChecklistItem = require("../models/Checklist");
const { TASK_LISTS } = require("../config/checklistTasks");
const { logAudit } = require("./auditLog");

/**
 * Creates a standard checklist for one employee/candidate, unless one
 * already exists for that type — same idempotency guard as the original
 * (so re-saving an employee with the same status doesn't duplicate the
 * checklist).
 */
async function createChecklistIfMissing(type, employeeName, department, actorId) {
  if (!employeeName) return { created: false, message: "Employee is required." };

  const exists = await ChecklistItem.exists({ type, employee: employeeName });
  if (exists) {
    return { created: false, message: `${type} checklist already exists for ${employeeName}.` };
  }

  const tasks = TASK_LISTS[type] || [];
  await ChecklistItem.insertMany(
    tasks.map(([task, category]) => ({ type, employee: employeeName, department, task, category }))
  );

  await logAudit({
    user: actorId,
    action: "Checklist Created",
    entityType: type,
    details: `${employeeName}: ${tasks.length} tasks`,
  });

  return { created: true, message: `${type} checklist created for ${employeeName}.` };
}

module.exports = { createChecklistIfMissing };
