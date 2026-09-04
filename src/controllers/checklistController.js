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
const { createChecklistIfMissing, markChecklistTaskDone } = require("../utils/checklists");
const PreOnboardingDetail = require("../models/PreOnboardingDetail");
const { WELCOME_KIT_ITEMS, BGV_STATUS, IT_PROVISIONING_STATUS } = require("../models/PreOnboardingDetail");
const { logAudit } = require("../utils/auditLog");

const TYPE_BY_SLUG = {
  "pre-onboarding": CHECKLIST_TYPE.PRE_ONBOARDING,
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

/*************************************************************
 * Pre-Onboarding Detail — port of PreOnboardingDetailEngine.gs's
 * getOrCreatePreOnboardingDetailsRow() / confirmJoiningDate() /
 * saveWelcomeKitProgress() / savePreOnboardingContactInfo(). Only
 * reachable under the "pre-onboarding" slug (checklistRoutes.js's
 * guardForSlug already applies its HR-team gate to every route
 * nested under "/:slug", these included).
 *************************************************************/
async function showPreOnboardingDetail(req, res) {
  if (req.params.slug !== "pre-onboarding") return res.status(404).render("errors/404");

  const employeeName = decodeURIComponent(req.params.employee);
  let detail = await PreOnboardingDetail.findOne({ employee: employeeName }).lean();
  if (!detail) {
    detail = { employee: employeeName, candidateEmail: "", designation: "", joiningDate: null, bgvVendorEmail: "", bgvStatus: BGV_STATUS.NOT_STARTED, itProvisioningStatus: IT_PROVISIONING_STATUS.NOT_STARTED, welcomeKitItems: [] };
  }

  res.render("onboarding/pre-onboarding-detail", {
    employeeName,
    detail,
    WELCOME_KIT_ITEMS,
    BGV_STATUS,
    IT_PROVISIONING_STATUS,
    message: req.query.message || null,
  });
}

async function getOrCreateDetail(employeeName) {
  let detail = await PreOnboardingDetail.findOne({ employee: employeeName });
  if (!detail) detail = await PreOnboardingDetail.create({ employee: employeeName });
  return detail;
}

async function savePreOnboardingContact(req, res) {
  if (req.params.slug !== "pre-onboarding") return res.status(404).render("errors/404");
  const employeeName = decodeURIComponent(req.params.employee);
  const detail = await getOrCreateDetail(employeeName);

  detail.candidateEmail = req.body.candidateEmail || "";
  detail.designation = req.body.designation || "";
  detail.bgvVendorEmail = req.body.bgvVendorEmail || "";
  detail.bgvStatus = Object.values(BGV_STATUS).includes(req.body.bgvStatus) ? req.body.bgvStatus : detail.bgvStatus;
  detail.itProvisioningStatus = Object.values(IT_PROVISIONING_STATUS).includes(req.body.itProvisioningStatus) ? req.body.itProvisioningStatus : detail.itProvisioningStatus;
  await detail.save();

  await logAudit({
    user: req.user._id,
    action: "Pre-Onboarding Contact Info Saved",
    entityType: CHECKLIST_TYPE.PRE_ONBOARDING,
    entityId: detail._id,
    details: employeeName,
  });

  res.redirect(`/onboarding/pre-onboarding/${encodeURIComponent(employeeName)}/detail?message=${encodeURIComponent("Contact info saved.")}`);
}

async function confirmJoiningDate(req, res) {
  if (req.params.slug !== "pre-onboarding") return res.status(404).render("errors/404");
  const employeeName = decodeURIComponent(req.params.employee);
  const detail = await getOrCreateDetail(employeeName);

  if (!req.body.joiningDate) {
    return res.redirect(`/onboarding/pre-onboarding/${encodeURIComponent(employeeName)}/detail?message=${encodeURIComponent("Joining date is required.")}`);
  }

  detail.joiningDate = new Date(req.body.joiningDate);
  await detail.save();

  await markChecklistTaskDone(CHECKLIST_TYPE.PRE_ONBOARDING, employeeName, "Joining Date Confirmed", req.user._id);

  await logAudit({
    user: req.user._id,
    action: "Joining Date Confirmed",
    entityType: CHECKLIST_TYPE.PRE_ONBOARDING,
    entityId: detail._id,
    details: `${employeeName}: ${detail.joiningDate.toISOString().slice(0, 10)}`,
  });

  res.redirect(`/onboarding/pre-onboarding/${encodeURIComponent(employeeName)}/detail?message=${encodeURIComponent("Joining date confirmed.")}`);
}

async function saveWelcomeKit(req, res) {
  if (req.params.slug !== "pre-onboarding") return res.status(404).render("errors/404");
  const employeeName = decodeURIComponent(req.params.employee);
  const detail = await getOrCreateDetail(employeeName);

  const checkedItems = [].concat(req.body.items || []).filter((i) => WELCOME_KIT_ITEMS.includes(i));
  detail.welcomeKitItems = checkedItems;
  await detail.save();

  const allDone = WELCOME_KIT_ITEMS.every((item) => checkedItems.includes(item));
  let message = `Welcome Kit progress saved (${checkedItems.length}/${WELCOME_KIT_ITEMS.length}).`;

  if (allDone) {
    await markChecklistTaskDone(CHECKLIST_TYPE.PRE_ONBOARDING, employeeName, "Welcome Kit Prepared", req.user._id);
    message = "Welcome Kit fully prepared — checklist task marked done.";
  }

  await logAudit({
    user: req.user._id,
    action: "Welcome Kit Progress Saved",
    entityType: CHECKLIST_TYPE.PRE_ONBOARDING,
    entityId: detail._id,
    details: `${employeeName}: ${checkedItems.length}/${WELCOME_KIT_ITEMS.length}`,
  });

  res.redirect(`/onboarding/pre-onboarding/${encodeURIComponent(employeeName)}/detail?message=${encodeURIComponent(message)}`);
}

module.exports = {
  TYPE_BY_SLUG,
  listChecklist,
  createChecklist,
  toggleTask,
  showPreOnboardingDetail,
  savePreOnboardingContact,
  confirmJoiningDate,
  saveWelcomeKit,
};
