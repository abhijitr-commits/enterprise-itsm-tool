/*************************************************************
 * changeController.js — port of ChangeEngine.gs.
 *************************************************************/
const Change = require("../models/Change");
const Problem = require("../models/Problem");
const Incident = require("../models/Incident");
const ChangeFreezeWindow = require("../models/ChangeFreezeWindow");
const { APPROVAL } = require("../models/ServiceRequest");
const { logAudit } = require("../utils/auditLog");
const { generateSequentialId } = require("../utils/idGenerator");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");
const { paginate } = require("../utils/pagination");
const { applyAutomation, recordAutomationRun } = require("../utils/automationEngine");
const { notifyUser } = require("../utils/notifications");
const { resolveIdsByCode, resolveOneIdByCode } = require("../utils/linkedRecords");
const { findFreezeWindowFor, findFreezeWindowsInRange } = require("../utils/changeFreeze");

const { IMPL } = Change;

/** <datalist> sources for the Linked Problem / Related Incidents fields — see problemController's listIncidentCodes for the same convention. */
async function listLinkOptions() {
  const [problems, incidents] = await Promise.all([
    Problem.find().select("problemId").sort({ createdDate: -1 }).limit(500).lean(),
    Incident.find().select("incidentId").sort({ createdDate: -1 }).limit(500).lean(),
  ]);
  return { problemCodes: problems.map((p) => p.problemId), incidentCodes: incidents.map((i) => i.incidentId) };
}

/**
 * Audit backlog — "Change Management maturity: freeze windows, calendar
 * view, conflict detection." A freeze window (see Master Data ->
 * Change Freeze Windows) blocks routine changes from being planned
 * inside it — but not High risk ones, since a freeze exists to keep
 * routine work off the calendar during a sensitive period, not to make
 * a genuine emergency change impossible to file. Thrown as a plain
 * Error so both createChange and updateChange's existing try/catch ->
 * re-render-with-error path picks it up with no extra plumbing.
 */
async function assertNotFrozen(plannedDate, riskLevel) {
  if (riskLevel === "High") return; // emergency changes may still be filed during a freeze
  const freezeWindow = await findFreezeWindowFor(plannedDate);
  if (!freezeWindow) return;
  const range = `${new Date(freezeWindow.startDate).toLocaleDateString()}–${new Date(freezeWindow.endDate).toLocaleDateString()}`;
  throw new Error(
    `This planned date falls inside a change freeze window — "${freezeWindow.title}" (${range})${freezeWindow.reason ? ": " + freezeWindow.reason : ""}. ` +
      `Pick a date outside the freeze, or submit this as a High risk change if it's a genuine emergency.`
  );
}

/**
 * Audit backlog — "calendar view, conflict detection." A month grid of
 * every Change's plannedDate plus every freeze window overlapping that
 * month, so CAB can see at a glance which days are frozen and which
 * days already have more than one change stacked on them (a same-day
 * conflict — not blocked like a freeze window, since two low-risk
 * changes on the same day isn't necessarily a problem, just something
 * a human should notice and judge).
 */
async function showCalendar(req, res) {
  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1; // 1-12

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // last instant of the last day

  const [changes, freezeWindows] = await Promise.all([
    Change.find({ plannedDate: { $gte: monthStart, $lte: monthEnd } })
      .select("changeId title riskLevel cabStatus plannedDate")
      .sort({ plannedDate: 1 })
      .lean(),
    findFreezeWindowsInRange(monthStart, monthEnd),
  ]);

  const changesByDay = {}; // "1".."31" -> [change,...]
  changes.forEach((c) => {
    const day = new Date(c.plannedDate).getDate();
    (changesByDay[day] = changesByDay[day] || []).push(c);
  });

  function freezeWindowCovering(day) {
    const dayDate = new Date(year, month - 1, day);
    return freezeWindows.find((fw) => new Date(fw.startDate) <= dayDate && new Date(fw.endDate) >= dayDate) || null;
  }

  const daysInMonth = monthEnd.getDate();
  const leadingBlanks = monthStart.getDay(); // 0 (Sun) .. 6 (Sat)

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dayChanges = changesByDay[day] || [];
    cells.push({
      day,
      changes: dayChanges,
      conflict: dayChanges.length > 1,
      freezeWindow: freezeWindowCovering(day),
      isToday: year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate(),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prevMonthDate = new Date(year, month - 2, 1);
  const nextMonthDate = new Date(year, month, 1);

  res.render("changes/calendar", {
    monthLabel: monthStart.toLocaleString("en-US", { month: "long", year: "numeric" }),
    weeks,
    freezeWindows,
    prevYear: prevMonthDate.getFullYear(),
    prevMonth: prevMonthDate.getMonth() + 1,
    nextYear: nextMonthDate.getFullYear(),
    nextMonth: nextMonthDate.getMonth() + 1,
    currentYear: year,
    currentMonth: month,
  });
}

async function listChanges(req, res) {
  const { q, cabStatus, implementationStatus } = req.query;

  const filter = {};
  if (cabStatus) filter.cabStatus = cabStatus;
  if (implementationStatus) filter.implementationStatus = implementationStatus;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = [
      "changeId",
      "title",
      "requestedBy",
      "department",
      "riskLevel",
      "rootCause",
      "correctiveAction",
      "lessonsLearned",
    ].map((f) => ({ [f]: rx }));
  }

  const { rows: changes, pageInfo } = await paginate(Change, filter, { createdDate: -1 }, req.query);

  res.render("changes/list", {
    changes,
    query: { q: q || "", cabStatus: cabStatus || "", implementationStatus: implementationStatus || "" },
    APPROVAL,
    IMPL,
    pageInfo,
  });
}

async function showNewForm(req, res) {
  const { problemCodes, incidentCodes } = await listLinkOptions();
  res.render("changes/new", { error: null, form: {}, problemCodes, incidentCodes });
}

async function createChange(req, res) {
  try {
    const data = req.body;
    for (const field of ["title", "description", "riskLevel", "plannedDate", "requestedBy", "department"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    await assertNotFrozen(data.plannedDate, data.riskLevel);

    const changeId = await generateSequentialId("CHG");
    const [linkedProblemId, linkedIncidentIds] = await Promise.all([
      resolveOneIdByCode(Problem, "problemId", data.linkedProblem),
      resolveIdsByCode(Incident, "incidentId", data.linkedIncidents),
    ]);

    const change = new Change({
      changeId,
      title: data.title,
      description: data.description,
      riskLevel: data.riskLevel,
      cabStatus: APPROVAL.PENDING,
      plannedDate: new Date(data.plannedDate),
      implementationStatus: IMPL.NOT_STARTED,
      requestedBy: data.requestedBy,
      department: data.department,
      linkedProblemId,
      linkedIncidentIds,
      createdBy: req.user.email,
    });

    const automationResult = await applyAutomation({ moduleName: "Change", trigger: "onCreate", doc: change });

    await change.save();

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Change",
      entityId: change._id,
      details: `${data.title} (${change.riskLevel} risk)`,
    });

    await recordAutomationRun(automationResult, { entityType: "Change", entityId: change._id, userId: req.user._id });

    res.redirect(`/changes/${change._id}?created=1`);
  } catch (err) {
    const { problemCodes, incidentCodes } = await listLinkOptions();
    res.status(400).render("changes/new", { error: err.message, form: req.body, problemCodes, incidentCodes });
  }
}

async function showChange(req, res) {
  const change = await Change.findById(req.params.id)
    .populate("linkedProblemId", "problemId title status")
    .populate("linkedIncidentIds", "incidentId subject status priority")
    .lean();
  if (!change) return res.status(404).render("errors/404");

  const [attachments, auditEntries, canUpload, { problemCodes, incidentCodes }] = await Promise.all([
    getAttachmentsForRecord("changes", change._id),
    getAuditTrailForRecord(change._id),
    hasPermission(req.user.role, "changes_edit"),
    listLinkOptions(),
  ]);

  res.render("changes/detail", {
    change,
    APPROVAL,
    IMPL,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    problemCodes,
    incidentCodes,
    moduleKey: "changes",
  });
}

async function updateChange(req, res) {
  try {
    const data = req.body;
    const change = await Change.findById(req.params.id);
    if (!change) return res.status(404).render("errors/404");

    if (change.cabStatus !== APPROVAL.PENDING) {
      throw new Error(
        `This change has already been ${change.cabStatus.toLowerCase()} by CAB and can no longer be edited directly. Use the implementation/close actions instead.`
      );
    }

    await assertNotFrozen(data.plannedDate, data.riskLevel);

    change.title = data.title;
    change.description = data.description;
    change.riskLevel = data.riskLevel;
    change.plannedDate = new Date(data.plannedDate);
    [change.linkedProblemId, change.linkedIncidentIds] = await Promise.all([
      resolveOneIdByCode(Problem, "problemId", data.linkedProblem),
      resolveIdsByCode(Incident, "incidentId", data.linkedIncidents),
    ]);

    await change.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Change",
      entityId: change._id,
      details: data.title,
    });

    res.redirect(`/changes/${change._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function decideChange(req, res) {
  const { decision } = req.body;
  if (decision !== APPROVAL.APPROVED && decision !== APPROVAL.REJECTED) {
    return res.status(400).send("Invalid decision.");
  }

  const change = await Change.findById(req.params.id);
  if (!change) return res.status(404).render("errors/404");

  change.cabStatus = decision;
  change.history.push({ field: "cabStatus", oldValue: APPROVAL.PENDING, newValue: decision, changedBy: req.user._id });

  if (decision === APPROVAL.REJECTED) {
    change.implementationStatus = IMPL.ROLLED_BACK;
    change.closedDate = new Date();
  }

  await change.save();

  await logAudit({
    user: req.user._id,
    action: "CAB Decision",
    entityType: "Change",
    entityId: change._id,
    details: decision,
  });

  // Architecture Phase 4 follow-up — "phase movement" notification.
  // requestedBy is a free-text display name (not a User reference), same
  // best-effort exact-name match as incidentController's engineer/reporter
  // notifications — silently finds no one if it doesn't match a real login.
  notifyUser({
    name: change.requestedBy,
    message: `Your change ${change.changeId} — ${change.title} was ${decision.toLowerCase()} by CAB.`,
    link: `/changes/${change._id}`,
  });

  res.redirect(`/changes/${change._id}`);
}

async function bulkDecideChanges(req, res) {
  const ids = [].concat(req.body.ids || []);
  const { decision } = req.body;
  if (decision !== APPROVAL.APPROVED && decision !== APPROVAL.REJECTED) {
    return res.status(400).send("Invalid decision.");
  }

  const update = { cabStatus: decision };
  if (decision === APPROVAL.REJECTED) {
    update.implementationStatus = IMPL.ROLLED_BACK;
    update.closedDate = new Date();
  }

  // Fetched before the update so the bulk-decision notifications below know
  // which changes were actually still PENDING (the same filter the update
  // itself uses) — same pattern as serviceRequestController's bulkDecideRequests.
  const affected = await Change.find({ _id: { $in: ids }, cabStatus: APPROVAL.PENDING })
    .select("_id changeId title requestedBy")
    .lean();

  const result = await Change.updateMany(
    { _id: { $in: ids }, cabStatus: APPROVAL.PENDING },
    { $set: update }
  );

  await logAudit({
    user: req.user._id,
    action: "Bulk CAB Decision",
    entityType: "Change",
    details: `${result.modifiedCount} of ${ids.length} change(s) ${decision.toLowerCase()}.`,
  });

  affected.forEach((c) => {
    notifyUser({
      name: c.requestedBy,
      message: `Your change ${c.changeId} — ${c.title} was ${decision.toLowerCase()} by CAB.`,
      link: `/changes/${c._id}`,
    });
  });

  res.redirect("/changes");
}

async function updateImplementationStatus(req, res) {
  try {
    const { implementationStatus, rootCause, correctiveAction, lessonsLearned } = req.body;
    const change = await Change.findById(req.params.id);
    if (!change) return res.status(404).render("errors/404");

    const previousImplementationStatus = change.implementationStatus;

    if (change.cabStatus !== APPROVAL.APPROVED) {
      throw new Error("This change has not been approved by CAB yet.");
    }

    // A change that reaches "Rolled Back" here means an approved
    // implementation was actually attempted and had to be backed out —
    // a real failure, not just a paperwork rejection (CAB rejecting a
    // change outright, before implementation ever starts, is handled
    // separately in decideChange() and doesn't go through this path).
    // Don't let that get closed out with nothing on record: require the
    // root cause, the corrective action taken, and the lesson learned
    // before the rollback is allowed to save, so the next team to hit
    // something similar has something to go on instead of just a
    // status badge.
    if (implementationStatus === IMPL.ROLLED_BACK) {
      for (const [field, label] of [
        ["rootCause", "Root cause"],
        ["correctiveAction", "Corrective action"],
        ["lessonsLearned", "Lessons learned"],
      ]) {
        if (!req.body[field] || !req.body[field].trim()) {
          throw new Error(`${label} is required when rolling back an implementation.`);
        }
      }
      change.rootCause = rootCause.trim();
      change.correctiveAction = correctiveAction.trim();
      change.lessonsLearned = lessonsLearned.trim();
      change.closedDate = new Date();
    }

    change.implementationStatus = implementationStatus;

    const automationResult = await applyAutomation({ moduleName: "Change", trigger: "onUpdate", doc: change });

    await change.save();

    await logAudit({
      user: req.user._id,
      action: "Implementation Status",
      entityType: "Change",
      entityId: change._id,
      details:
        implementationStatus === IMPL.ROLLED_BACK
          ? `${implementationStatus} — root cause: ${change.rootCause}`
          : implementationStatus,
    });

    await recordAutomationRun(automationResult, { entityType: "Change", entityId: change._id, userId: req.user._id });

    // Architecture Phase 4 follow-up — "phase movement" notification: the
    // requester hears about it the moment implementation status actually
    // moves (In Progress, Implemented, Rolled Back), not just at CAB decision.
    if (change.implementationStatus !== previousImplementationStatus) {
      notifyUser({
        name: change.requestedBy,
        message: `Your change ${change.changeId} — ${change.title} is now ${change.implementationStatus}.`,
        link: `/changes/${change._id}`,
      });
    }

    res.redirect(`/changes/${change._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function closeChangeWithPIR(req, res) {
  const { pirNotes } = req.body;
  const change = await Change.findById(req.params.id);
  if (!change) return res.status(404).render("errors/404");

  change.implementationStatus = IMPL.IMPLEMENTED;
  change.pirNotes = pirNotes || "";
  change.closedDate = new Date();
  await change.save();

  await logAudit({
    user: req.user._id,
    action: "Close with PIR",
    entityType: "Change",
    entityId: change._id,
    details: pirNotes || "",
  });

  notifyUser({
    name: change.requestedBy,
    message: `Your change ${change.changeId} — ${change.title} is now Implemented.`,
    link: `/changes/${change._id}`,
  });

  res.redirect(`/changes/${change._id}`);
}

async function addComment(req, res) {
  const change = await Change.findById(req.params.id);
  if (!change) return res.status(404).render("errors/404");

  change.comments.push({
    author: req.user._id,
    text: req.body.text,
    isInternal: req.body.isInternal === "on",
  });
  await change.save();

  res.redirect(`/changes/${change._id}`);
}

module.exports = {
  listChanges,
  showCalendar,
  showNewForm,
  createChange,
  showChange,
  updateChange,
  decideChange,
  bulkDecideChanges,
  updateImplementationStatus,
  closeChangeWithPIR,
  addComment,
};
