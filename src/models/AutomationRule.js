/*************************************************************
 * AutomationRule.js — the "if condition X on module Y, then
 * action Z" rule engine's data model (Architecture Phase 1 —
 * see itsm_architecture_comparison.md). This is the piece every
 * commercial ITSM platform (ServiceNow's Flow Designer, BMC's
 * Process Designer, Freshservice's Workflow Automator, Jira SM's
 * Automation rules) has and this app didn't: a way for an admin
 * to change "when this happens, do that" behavior by editing
 * data instead of editing a controller and redeploying.
 *
 * A rule is scoped to one module + one trigger (onCreate /
 * onUpdate), carries a small set of field conditions (all-AND or
 * any-OR), and a small set of actions run in order when the
 * conditions match. See src/utils/automationEngine.js for how
 * conditions/actions are actually evaluated and executed, and
 * src/controllers/automationController.js for the admin CRUD UI.
 *************************************************************/
const mongoose = require("mongoose");

const conditionSchema = new mongoose.Schema(
  {
    field: { type: String, trim: true, default: "" },
    operator: {
      type: String,
      enum: ["equals", "notEquals", "contains", "isEmpty", "isNotEmpty"],
      default: "equals",
    },
    value: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    // setField      — sets doc[field] = value (e.g. auto-assign engineer,
    //                 auto-set category) before the record is saved.
    // escalatePriority — bumps priority/riskLevel one level up
    //                 (Low -> Medium -> High -> Critical), capped at Critical.
    // notifyUser    — an in-app bell notification (utils/notifications.js).
    // notifyChannel — a Slack/Teams webhook notification, reusing whatever
    //                 webhook URL is already configured at Admin ->
    //                 Integration Settings (zero new accounts required).
    type: {
      type: String,
      enum: ["setField", "escalatePriority", "notifyUser", "notifyChannel"],
      required: true,
    },
    field: { type: String, trim: true, default: "" }, // setField target field
    value: { type: String, trim: true, default: "" }, // setField target value
    target: { type: String, enum: ["assignee", "requester", "reporter", "specific"], default: "reporter" }, // notifyUser
    email: { type: String, trim: true, default: "" }, // notifyUser target=specific
    message: { type: String, trim: true, default: "" }, // notifyUser / notifyChannel body (supports {{recordId}}/{{summary}}/{{status}}/{{priority}})
  },
  { _id: false }
);

const automationRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    module: {
      type: String,
      required: true,
      enum: ["Incident", "ServiceRequest", "Problem", "Change"],
    },
    trigger: { type: String, required: true, enum: ["onCreate", "onUpdate"] },
    conditionLogic: { type: String, enum: ["AND", "OR"], default: "AND" },
    conditions: [conditionSchema],
    actions: [actionSchema],
    enabled: { type: Boolean, default: true },
    // Lower runs first when more than one rule matches the same event —
    // matters when an earlier rule's setField action could affect a
    // later rule's condition (e.g. one rule sets category, another
    // matches on category).
    order: { type: Number, default: 0 },
    // Lightweight telemetry so an admin can tell a rule is actually
    // firing (or silently never matching) without digging through the
    // audit log — see automationEngine.js's recordAutomationRun().
    runCount: { type: Number, default: 0 },
    lastRunAt: { type: Date, default: null },
    createdBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AutomationRule", automationRuleSchema);
