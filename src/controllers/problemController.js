/*************************************************************
 * problemController.js — port of ProblemEngine.gs.
 *************************************************************/
const Problem = require("../models/Problem");
const { STATUS } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");

async function listProblems(req, res) {
  const { q, status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["problemId", "title", "description", "owner", "linkedIncidents"].map((f) => ({ [f]: rx }));
  }

  const problems = await Problem.find(filter).sort({ createdDate: -1 }).lean();

  res.render("problems/list", {
    problems,
    query: { q: q || "", status: status || "" },
    STATUS,
  });
}

function showNewForm(req, res) {
  res.render("problems/new", { error: null, form: {} });
}

async function createProblem(req, res) {
  try {
    const data = req.body;
    for (const field of ["title", "description"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const problemId = await generateSequentialId("PRB");

    const problem = await Problem.create({
      problemId,
      title: data.title,
      description: data.description,
      linkedIncidents: data.linkedIncidents || "",
      rootCause: "",
      knownError: "No",
      status: STATUS.OPEN,
      owner: data.owner || "",
      createdBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Problem",
      entityId: problem._id,
      details: data.title,
    });

    res.redirect(`/problems/${problem._id}?created=1`);
  } catch (err) {
    res.status(400).render("problems/new", { error: err.message, form: req.body });
  }
}

async function showProblem(req, res) {
  const problem = await Problem.findById(req.params.id).lean();
  if (!problem) return res.status(404).render("errors/404");

  const [attachments, auditEntries, canUpload] = await Promise.all([
    getAttachmentsForRecord("problems", problem._id),
    getAuditTrailForRecord(problem._id),
    hasPermission(req.user.role, "problems_edit"),
  ]);

  res.render("problems/detail", {
    problem,
    STATUS,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    moduleKey: "problems",
  });
}

async function updateProblem(req, res) {
  try {
    const data = req.body;
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).render("errors/404");

    problem.title = data.title;
    problem.description = data.description;
    problem.linkedIncidents = data.linkedIncidents || "";
    problem.rootCause = data.rootCause || "";
    problem.knownError = data.knownError === "Yes" ? "Yes" : "No";
    problem.status = data.status || STATUS.OPEN;
    problem.owner = data.owner || "";

    if (problem.status === STATUS.CLOSED && !problem.closedDate) {
      problem.closedDate = new Date();
    }

    await problem.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Problem",
      entityId: problem._id,
      details: `Status: ${problem.status}`,
    });

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
  listProblems,
  showNewForm,
  createProblem,
  showProblem,
  updateProblem,
  closeProblem,
  addComment,
};
