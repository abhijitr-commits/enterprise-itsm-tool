/*************************************************************
 * checklistController.js — the "view/manage" side of the four
 * checklist types in models/Checklist.js. Creation-on-a-schedule
 * (triggered by employee status changes) lives in
 * employeeController.js / resignationController.js; this covers
 * the manual "Create Checklist" action and toggling tasks done,
 * same split as the original's public vs internal function pairs.
 *************************************************************/
const ChecklistItem = require("../models/Checklist");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { createChecklistIfMissing } = require("../utils/checklists");

const TYPE_BY_SLUG = {
  onboarding: CHECKLIST_TYPE.ONBOARDING,
  offboarding: CHECKLIST_TYPE.OFFBOARDING,
  "admin-onboarding": CHECKLIST_TYPE.ADMIN_ONBOARDING,
  "admin-offboarding": CHECKLIST_TYPE.ADMIN_OFFBOARDING,
};

function resolveType(req, res) {
  const type = TYPE_BY_SLUG[req.params.slug];
  if (!type) {
    res.status(404).render("errors/404");
    return null;
  }
  return type;
}

async function listChecklist(req, res) {
  const type = resolveType(req, res);
  if (!type) return;

  const items = await ChecklistItem.find({ type }).sort({ employee: 1, createdAt: 1 }).lean();

  // Group by employee so HR sees one card per person with all their tasks.
  const byEmployee = {};
  for (const item of items) {
    if (!byEmployee[item.employee]) byEmployee[item.employee] = { employee: item.employee, department: item.department, tasks: [] };
    byEmployee[item.employee].tasks.push(item);
  }

  res.render("onboarding/checklist", {
    slug: req.params.slug,
    type,
    groups: Object.values(byEmployee),
    tabs: Object.entries(TYPE_BY_SLUG).map(([slug, t]) => ({ slug, label: t })),
    message: req.query.message || null,
  });
}

async function createChecklist(req, res) {
  const type = resolveType(req, res);
  if (!type) return;

  const { employee, department } = req.body;
  const result = await createChecklistIfMissing(type, employee, department, req.user._id);

  res.redirect(`/onboarding/${req.params.slug}?message=${encodeURIComponent(result.message)}`);
}

async function toggleTask(req, res) {
  const type = resolveType(req, res);
  if (!type) return;

  const item = await ChecklistItem.findOne({ _id: req.params.id, type });
  if (!item) return res.status(404).render("errors/404");

  const done = req.body.done === "1";
  item.status = done ? "Done" : "Pending";
  item.completedDate = done ? new Date() : undefined;
  await item.save();

  res.redirect(`/onboarding/${req.params.slug}`);
}

module.exports = { TYPE_BY_SLUG, listChecklist, createChecklist, toggleTask };
