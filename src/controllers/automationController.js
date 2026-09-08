/*************************************************************
 * automationController.js — admin CRUD for AutomationRule
 * documents (Architecture Phase 1 — see
 * itsm_architecture_comparison.md). Gated by the automation_manage
 * permission key (Administrator-only by default, same tier as
 * admin_manage_settings — see config/permissions.js), since a rule
 * that mis-fires can change field values or spam notifications
 * across every ticket in a module.
 *
 * The form below uses a fixed 3 condition rows + 3 action rows
 * layout (empty rows are simply dropped on save) rather than a
 * fully dynamic add/remove row builder — same lightweight
 * "plain server-rendered form, minimal JS" style already used by
 * changes/detail.ejs's rollback PIR panel. Three of each is enough
 * for real rules (e.g. "Category=Robotics/Equipment AND
 * Priority=Critical -> escalate + notify assignee + ping Slack")
 * without the added complexity of a JS-driven repeating fieldset.
 *************************************************************/
const AutomationRule = require("../models/AutomationRule");
const { MODULE_META } = require("../utils/automationEngine");

const MODULE_OPTIONS = Object.keys(MODULE_META); // ["Incident", "ServiceRequest", "Problem", "Change"]

// Union of the fields that make sense to condition/set across all four
// modules — offered as a single <datalist> rather than a per-module
// dynamic <select> (see form.ejs), which keeps this a plain form instead
// of needing module-aware client-side JS to swap field options.
const FIELD_SUGGESTIONS = [
  "status",
  "priority",
  "category",
  "department",
  "location",
  "engineer",
  "employeeName",
  "approvalStatus",
  "fulfillmentStatus",
  "catalogItem",
  "requester",
  "owner",
  "knownError",
  "cabStatus",
  "implementationStatus",
  "riskLevel",
  "requestedBy",
];

const CONDITION_ROWS = 3;
const ACTION_ROWS = 3;

function parseConditions(body) {
  const conditions = [];
  for (let i = 0; i < CONDITION_ROWS; i++) {
    const field = (body[`cond_field_${i}`] || "").trim();
    if (!field) continue;
    conditions.push({
      field,
      operator: body[`cond_operator_${i}`] || "equals",
      value: (body[`cond_value_${i}`] || "").trim(),
    });
  }
  return conditions;
}

function parseActions(body) {
  const actions = [];
  for (let i = 0; i < ACTION_ROWS; i++) {
    const type = body[`action_type_${i}`] || "";
    if (!type) continue;
    actions.push({
      type,
      field: (body[`action_field_${i}`] || "").trim(),
      value: (body[`action_value_${i}`] || "").trim(),
      target: body[`action_target_${i}`] || "reporter",
      email: (body[`action_email_${i}`] || "").trim(),
      message: (body[`action_message_${i}`] || "").trim(),
    });
  }
  return actions;
}

function formLocals(extra) {
  return { MODULE_OPTIONS, FIELD_SUGGESTIONS, CONDITION_ROWS, ACTION_ROWS, ...extra };
}

// Rebuilds a rule-shaped object (name/module/trigger/conditionLogic/
// enabled/order/conditions[]/actions[]) from a raw failed POST body, so
// form.ejs can always assume `rule.conditions`/`rule.actions` are arrays
// — whether `rule` came from the DB (edit form) or from a rejected
// submission (re-displaying what the admin just typed).
function ruleShapeFromBody(body, idForDisplay) {
  return {
    _id: idForDisplay,
    name: body.name || "",
    module: body.module || "",
    trigger: body.trigger || "",
    conditionLogic: body.conditionLogic === "OR" ? "OR" : "AND",
    enabled: body.enabled === "on" || body.enabled === "true",
    order: body.order || 0,
    conditions: parseConditions(body),
    actions: parseActions(body),
  };
}

async function listRules(req, res) {
  const rules = await AutomationRule.find().sort({ module: 1, order: 1, createdAt: 1 }).lean();
  res.render("automation/list", { rules, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("automation/form", formLocals({ rule: null, error: null }));
}

async function createRule(req, res) {
  try {
    const body = req.body;
    const name = String(body.name || "").trim();
    if (!name) throw new Error("Name is required.");
    if (!MODULE_OPTIONS.includes(body.module)) throw new Error("Module is required.");
    if (!["onCreate", "onUpdate"].includes(body.trigger)) throw new Error("Trigger is required.");

    const conditions = parseConditions(body);
    const actions = parseActions(body);
    if (actions.length === 0) throw new Error("At least one action is required.");

    await AutomationRule.create({
      name,
      module: body.module,
      trigger: body.trigger,
      conditionLogic: body.conditionLogic === "OR" ? "OR" : "AND",
      conditions,
      actions,
      enabled: body.enabled === "on" || body.enabled === "true",
      order: Number(body.order) || 0,
      createdBy: req.user.email,
    });

    res.redirect(`/automation?message=${encodeURIComponent(`"${name}" created.`)}`);
  } catch (err) {
    res.status(400).render("automation/form", formLocals({ rule: ruleShapeFromBody(req.body, null), error: err.message }));
  }
}

async function showEditForm(req, res) {
  const rule = await AutomationRule.findById(req.params.id).lean();
  if (!rule) return res.status(404).render("errors/404");
  res.render("automation/form", formLocals({ rule, error: null }));
}

async function updateRule(req, res) {
  try {
    const rule = await AutomationRule.findById(req.params.id);
    if (!rule) return res.status(404).render("errors/404");

    const body = req.body;
    const name = String(body.name || "").trim();
    if (!name) throw new Error("Name is required.");
    if (!MODULE_OPTIONS.includes(body.module)) throw new Error("Module is required.");
    if (!["onCreate", "onUpdate"].includes(body.trigger)) throw new Error("Trigger is required.");

    const conditions = parseConditions(body);
    const actions = parseActions(body);
    if (actions.length === 0) throw new Error("At least one action is required.");

    rule.name = name;
    rule.module = body.module;
    rule.trigger = body.trigger;
    rule.conditionLogic = body.conditionLogic === "OR" ? "OR" : "AND";
    rule.conditions = conditions;
    rule.actions = actions;
    rule.enabled = body.enabled === "on" || body.enabled === "true";
    rule.order = Number(body.order) || 0;

    await rule.save();

    res.redirect(`/automation?message=${encodeURIComponent(`"${rule.name}" updated.`)}`);
  } catch (err) {
    res.status(400).render("automation/form", formLocals({ rule: ruleShapeFromBody(req.body, req.params.id), error: err.message }));
  }
}

async function toggleRule(req, res) {
  const rule = await AutomationRule.findById(req.params.id);
  if (!rule) return res.status(404).render("errors/404");
  rule.enabled = !rule.enabled;
  await rule.save();
  res.redirect(`/automation?message=${encodeURIComponent(`"${rule.name}" ${rule.enabled ? "enabled" : "disabled"}.`)}`);
}

async function deleteRule(req, res) {
  const rule = await AutomationRule.findByIdAndDelete(req.params.id);
  if (!rule) return res.status(404).render("errors/404");
  res.redirect(`/automation?message=${encodeURIComponent(`"${rule.name}" deleted.`)}`);
}

module.exports = {
  listRules,
  showNewForm,
  createRule,
  showEditForm,
  updateRule,
  toggleRule,
  deleteRule,
  MODULE_OPTIONS,
  FIELD_SUGGESTIONS,
};
