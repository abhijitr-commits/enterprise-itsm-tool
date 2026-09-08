/*************************************************************
 * automationEngine.js — evaluates AutomationRule documents
 * against a module's create/update event and applies whichever
 * actions match, without any module's controller having to know
 * the rules exist. This is the "workflow/automation engine" layer
 * every commercial ITSM platform sits its Incident/Request/
 * Problem/Change apps on top of (see itsm_architecture_comparison.md,
 * Phase 1) — this app's version of ServiceNow's Flow Designer /
 * BMC's Process Designer / Freshservice's Workflow Automator /
 * Jira Service Management's Automation rules.
 *
 * Usage from a controller (see incidentController.js etc.):
 *   const automationResult = await applyAutomation({ moduleName: "Incident", trigger: "onCreate", doc: incident });
 *   await incident.save();                     // setField/escalatePriority land in this one save
 *   await recordAutomationRun(automationResult, { entityType: "Incident", entityId: incident._id, userId: req.user._id });
 *
 * `doc` can be an unsaved `new Model({...})` instance (Mongoose
 * assigns _id client-side, before save, so notifyUser's `link`
 * still works) or an already-persisted document being updated —
 * either way this reads/writes plain field values on it and never
 * calls .save() itself, so the controller stays in full control of
 * exactly when the write happens.
 *
 * Never throws: every rule/action is evaluated defensively so a
 * misconfigured rule degrades to "did nothing" instead of failing
 * the create/update it's attached to.
 *************************************************************/
const AutomationRule = require("../models/AutomationRule");
const { logAudit } = require("./auditLog");
const { notifyUser, notifyChannels } = require("./notifications");
const { PRIORITY } = require("../config/constants");

const PRIORITY_ORDER = [PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH, PRIORITY.CRITICAL];

// Per-module field map so one generic engine can support all four
// ticket-lifecycle modules without hardcoding module-specific logic
// at every call site. Extending this to Asset/CMDB later is just
// adding a row here plus two applyAutomation() call sites.
const MODULE_META = {
  Incident: { idField: "incidentId", summaryField: "subject", urlPrefix: "incidents", entityType: "Incident", assigneeField: "engineer", requesterField: "employeeName" },
  ServiceRequest: { idField: "requestId", summaryField: "catalogItem", urlPrefix: "requests", entityType: "Service Request", assigneeField: null, requesterField: "requester" },
  Problem: { idField: "problemId", summaryField: "title", urlPrefix: "problems", entityType: "Problem", assigneeField: "owner", requesterField: null },
  Change: { idField: "changeId", summaryField: "title", urlPrefix: "changes", entityType: "Change", assigneeField: null, requesterField: "requestedBy" },
};

function nextPriority(current) {
  const idx = PRIORITY_ORDER.indexOf(current);
  if (idx === -1 || idx === PRIORITY_ORDER.length - 1) return current;
  return PRIORITY_ORDER[idx + 1];
}

function conditionMatches(actualValue, operator, expected) {
  const a = actualValue === undefined || actualValue === null ? "" : String(actualValue);
  const e = expected === undefined || expected === null ? "" : String(expected);
  switch (operator) {
    case "equals":
      return a.toLowerCase() === e.toLowerCase();
    case "notEquals":
      return a.toLowerCase() !== e.toLowerCase();
    case "contains":
      return a.toLowerCase().includes(e.toLowerCase());
    case "isEmpty":
      return a.trim() === "";
    case "isNotEmpty":
      return a.trim() !== "";
    default:
      return false;
  }
}

function ruleMatches(rule, doc) {
  const conditions = (rule.conditions || []).filter((c) => c && c.field);
  if (conditions.length === 0) return true; // no conditions configured = always matches its trigger
  const results = conditions.map((c) => conditionMatches(doc[c.field], c.operator, c.value));
  return rule.conditionLogic === "OR" ? results.some(Boolean) : results.every(Boolean);
}

function fillTemplate(template, data) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => (data[key] !== undefined && data[key] !== null ? data[key] : ""));
}

function templateData(moduleName, doc) {
  const meta = MODULE_META[moduleName] || {};
  return {
    recordId: (meta.idField && doc[meta.idField]) || "",
    summary: (meta.summaryField && doc[meta.summaryField]) || "",
    status: doc.status || doc.implementationStatus || doc.approvalStatus || doc.fulfillmentStatus || doc.cabStatus || "",
    priority: doc.priority || doc.riskLevel || "",
  };
}

/**
 * Evaluates every enabled rule for `moduleName`+`trigger` against `doc`
 * and applies matching actions. setField/escalatePriority mutate `doc`
 * directly (so the caller's very next .save() picks them up); notifyUser/
 * notifyChannel fire immediately but fire-and-forget (same convention as
 * every other notification call site in this app — see notifications.js),
 * since they don't need `doc` to already be persisted (a `new Model()`
 * instance already has its final _id and any pre-generated *Id field).
 *
 * Returns { summaries, ruleIds } for the caller to hand to
 * recordAutomationRun() right after the save completes.
 */
async function applyAutomation({ moduleName, trigger, doc }) {
  const meta = MODULE_META[moduleName];
  const summaries = [];
  const ruleIds = [];
  if (!meta || !doc) return { summaries, ruleIds };

  try {
    const rules = await AutomationRule.find({ module: moduleName, trigger, enabled: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    for (const rule of rules) {
      if (!ruleMatches(rule, doc)) continue;
      ruleIds.push(rule._id);

      for (const action of rule.actions || []) {
        if (!action || !action.type) continue;

        if (action.type === "setField" && action.field) {
          const before = doc[action.field];
          if (before !== action.value) {
            doc[action.field] = action.value;
            summaries.push(`[${rule.name}] Set ${action.field}: "${before || ""}" -> "${action.value}"`);
          }
        } else if (action.type === "escalatePriority") {
          if (doc.priority && PRIORITY_ORDER.includes(doc.priority)) {
            const before = doc.priority;
            doc.priority = nextPriority(doc.priority);
            if (doc.priority !== before) summaries.push(`[${rule.name}] Escalated priority: ${before} -> ${doc.priority}`);
          } else if (doc.riskLevel && PRIORITY_ORDER.includes(doc.riskLevel)) {
            const before = doc.riskLevel;
            doc.riskLevel = nextPriority(doc.riskLevel);
            if (doc.riskLevel !== before) summaries.push(`[${rule.name}] Escalated risk level: ${before} -> ${doc.riskLevel}`);
          }
        } else if (action.type === "notifyUser") {
          const message = fillTemplate(
            action.message || `${meta.entityType} {{recordId}} needs your attention.`,
            templateData(moduleName, doc)
          );
          const link = doc._id ? `/${meta.urlPrefix}/${doc._id}` : "";
          const opts = { message, link };
          if (action.target === "specific" && action.email) opts.email = action.email;
          else if (action.target === "assignee" && meta.assigneeField && doc[meta.assigneeField]) opts.name = doc[meta.assigneeField];
          else if (action.target === "requester" && meta.requesterField && doc[meta.requesterField]) opts.name = doc[meta.requesterField];
          else opts.email = doc.createdBy;

          if (opts.email || opts.name) {
            notifyUser(opts); // fire-and-forget, matches every other call site in this app
            summaries.push(`[${rule.name}] Notified ${action.target || "reporter"}`);
          }
        } else if (action.type === "notifyChannel") {
          const message = fillTemplate(
            action.message || `${meta.entityType} {{recordId}} — {{summary}}`,
            templateData(moduleName, doc)
          );
          notifyChannels(rule.name, message); // fire-and-forget; silently no-ops if no webhook is configured yet
          summaries.push(`[${rule.name}] Sent Slack/Teams notification`);
        }
      }
    }
  } catch (err) {
    console.error(`[automationEngine] applyAutomation failed for ${moduleName}/${trigger} (non-fatal):`, err.message);
  }

  return { summaries, ruleIds };
}

/**
 * Call once, right after the controller's own .save()/create() and its
 * own logAudit() for the create/update itself. Bumps each matched rule's
 * runCount/lastRunAt and writes one extra "Automation" audit entry
 * summarizing what fired — searchable the same way every other audit
 * entry is, so "why did this ticket's priority change" has an answer.
 * A no-op (no extra DB writes) when nothing matched.
 */
async function recordAutomationRun({ summaries, ruleIds } = {}, { entityType, entityId, userId }) {
  if (!summaries || summaries.length === 0) return;
  try {
    if (ruleIds && ruleIds.length) {
      await AutomationRule.updateMany({ _id: { $in: ruleIds } }, { $inc: { runCount: 1 }, $set: { lastRunAt: new Date() } });
    }
    await logAudit({
      user: userId,
      action: "Automation",
      entityType,
      entityId,
      details: summaries.join("; "),
    });
  } catch (err) {
    console.error("[automationEngine] recordAutomationRun failed (non-fatal):", err.message);
  }
}

module.exports = { applyAutomation, recordAutomationRun, MODULE_META };
