/*************************************************************
 * problemController.js — port of ProblemEngine.gs.
 *************************************************************/
const Problem = require("../models/Problem");
const Incident = require("../models/Incident");
const Change = require("../models/Change");
const { STATUS } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");
const { paginate } = require("../utils/pagination");
const { applyAutomation, recordAutomationRun } = require("../utils/automationEngine");
const { notifyUser } = require("../utils/notifications");
const { resolveIdsByCode } = require("../utils/linkedRecords");
const { resolveAssigneeRef } = require("../utils/userDirectory");

/** <datalist> of Incident IDs for the Linked Incidents field — same convenience-list convention as incidentController's listAssetNames. Bare IDs, not "ID — subject", since resolveIdsByCode matches the typed text exactly against incidentId. */
async function listIncidentCodes() {
  const incidents = await Incident.find().select("incidentId").sort({ createdDate: -1 }).limit(500).lean();
  return incidents.map((i) => i.incidentId);
}

/**
 * Audit backlog — "Known Error Database (KEDB) for Problem Management."
 * A dedicated, searchable view of every Problem marked knownError:"Yes",
 * showing the root cause AND the workaround side by side — the two
 * things a Service Desk agent actually needs when a new incident comes
 * in that looks like something already diagnosed but not yet fixed.
 * Deliberately its own list (not just a filter link on the regular
 * Problem Register) so it reads like the reference tool it's meant to
 * be, matching how KEDB is its own screen in ServiceNow/Remedy.
 */
async function listKnownErrors(req, res) {
  const { q } = req.query;

  const filter = { knownError: "Yes" };
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["problemId", "title", "rootCause", "workaround", "linkedIncidents"].map((f) => ({ [f]: rx }));
  }

  const { rows: knownErrors, pageInfo } = await paginate(Problem, filter, { createdDate: -1 }, req.query);

  res.render("problems/kedb", {
    knownErrors,
    query: { q: q || "" },
    pageInfo,
  });
}

async function listProblems(req, res) {
  const { q, status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["problemId", "title", "description", "owner", "linkedIncidents"].map((f) => ({ [f]: rx }));
  }

  const { rows: problems, pageInfo } = await paginate(Problem, filter, { createdDate: -1 }, req.query);

  res.render("problems/list", {
    problems,
    query: { q: q || "", status: status || "" },
    STATUS,
    pageInfo,
  });
}

async function showNewForm(req, res) {
  const incidentCodes = await listIncidentCodes();
  res.render("problems/new", { error: null, form: {}, incidentCodes });
}

async function createProblem(req, res) {
  try {
    const data = req.body;
    for (const field of ["title", "description"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const problemId = await generateSequentialId("PRB");
    const linkedIncidentIds = await resolveIdsByCode(Incident, "incidentId", data.linkedIncidents);

    const problem = new Problem({
      problemId,
      title: data.title,
      description: data.description,
      linkedIncidents: data.linkedIncidents || "",
      linkedIncidentIds,
      rootCause: "",
      knownError: "No",
      status: STATUS.OPEN,
      owner: data.owner || "",
      ownerRef: data.owner ? await resolveAssigneeRef(data.owner) : null, // task #102
      createdBy: req.user.email,
    });

    const automationResult = await applyAutomation({ moduleName: "Problem", trigger: "onCreate", doc: problem });

    await problem.save();

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Problem",
      entityId: problem._id,
      details: data.title,
    });

    await recordAutomationRun(automationResult, { entityType: "Problem", entityId: problem._id, userId: req.user._id });

    res.redirect(`/problems/${problem._id}?created=1`);
  } catch (err) {
    const incidentCodes = await listIncidentCodes();
    res.status(400).render("problems/new", { error: err.message, form: req.body, incidentCodes });
  }
}

async function showProblem(req, res) {
  const problem = await Problem.findById(req.params.id).populate("linkedIncidentIds", "incidentId subject status priority").lean();
  if (!problem) return res.status(404).render("errors/404");

  const [attachments, auditEntries, canUpload, incidentCodes, linkedChanges] = await Promise.all([
    getAttachmentsForRecord("problems", problem._id),
    getAuditTrailForRecord(problem._id),
    hasPermission(req.user.role, "problems_edit"),
    listIncidentCodes(),
    // Reverse of Change.linkedProblemId — audit backlog: linked records
    // should actually navigate to each other, both directions, not just
    // Problem -> Incident.
    Change.find({ linkedProblemId: problem._id }).select("changeId title cabStatus implementationStatus").lean(),
  ]);

  res.render("problems/detail", {
    problem,
    STATUS,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    incidentCodes,
    linkedChanges,
    moduleKey: "problems",
  });
}

async function updateProblem(req, res) {
  try {
    const data = req.body;
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).render("errors/404");

    const previousStatus = problem.status;

    problem.title = data.title;
    problem.description = data.description;
    problem.linkedIncidents = data.linkedIncidents || "";
    problem.linkedIncidentIds = await resolveIdsByCode(Incident, "incidentId", data.linkedIncidents);
    problem.rootCause = data.rootCause || "";
    problem.workaround = data.workaround || "";
    problem.knownError = data.knownError === "Yes" ? "Yes" : "No";
    problem.status = data.status || STATUS.OPEN;
    problem.owner = data.owner || "";
    problem.ownerRef = problem.owner ? await resolveAssigneeRef(problem.owner) : null; // task #102

    if (problem.status === STATUS.CLOSED && !problem.closedDate) {
      problem.closedDate = new Date();
    }

    const automationResult = await applyAutomation({ moduleName: "Problem", trigger: "onUpdate", doc: problem });

    await problem.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Problem",
      entityId: problem._id,
      details: `Status: ${problem.status}`,
    });

    // Architecture Phase 4 follow-up — "phase movement" notification: the
    // person who raised the problem (createdBy is a reliable real email,
    // unlike the free-text owner/linkedIncidents fields) hears about it
    // the moment its status actually moves, not just on the initial log.
    // Fire-and-forget, same convention as every other notifyUser() call.
    if (problem.status !== previousStatus) {
      notifyUser({
        email: problem.createdBy,
        message: `Problem ${problem.problemId} — ${problem.title} is now ${problem.status}.`,
        link: `/problems/${problem._id}`,
      });
    }

    await recordAutomationRun(automationResult, { entityType: "Problem", entityId: problem._id, userId: req.user._id });

    res.redirect(`/problems/${problem._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function closeProblem(req, res) {
  const problem = await Problem.findById(req.params.id);
  if (!problem) return res.status(404).render("errors/404");

  problem.status = STATUS.CLOSED;
  problem.closedDate = new Date();
  await problem.save();

  await logAudit({
    user: req.user._id,
    action: "Close",
    entityType: "Problem",
    entityId: problem._id,
  });

  notifyUser({
    email: problem.createdBy,
    message: `Problem ${problem.problemId} — ${problem.title} is now Closed.`,
    link: `/problems/${problem._id}`,
  });

  res.redirect(`/problems/${problem._id}`);
}

async function addComment(req, res) {
  const problem = await Problem.findById(req.params.id);
  if (!problem) return res.status(404).render("errors/404");

  problem.comments.push({
    author: req.user._id,
    text: req.body.text,
    isInternal: req.body.isInternal === "on",
  });
  await problem.save();

  res.redirect(`/problems/${problem._id}`);
}

module.exports = {
  listKnownErrors,
  listProblems,
  showNewForm,
  createProblem,
  showProblem,
  updateProblem,
  closeProblem,
  addComment,
};
