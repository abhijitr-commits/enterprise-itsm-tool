/*************************************************************
 * changeController.js — port of ChangeEngine.gs.
 *************************************************************/
const Change = require("../models/Change");
const { APPROVAL } = require("../models/ServiceRequest");
const { logAudit } = require("../utils/auditLog");
const { generateSequentialId } = require("../utils/idGenerator");

const { IMPL } = Change;

async function listChanges(req, res) {
  const { q, cabStatus, implementationStatus } = req.query;

  const filter = {};
  if (cabStatus) filter.cabStatus = cabStatus;
  if (implementationStatus) filter.implementationStatus = implementationStatus;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["changeId", "title", "requestedBy", "department", "riskLevel"].map((f) => ({ [f]: rx }));
  }

  const changes = await Change.find(filter).sort({ createdDate: -1 }).lean();

  res.render("changes/list", {
    changes,
    query: { q: q || "", cabStatus: cabStatus || "", implementationStatus: implementationStatus || "" },
    APPROVAL,
    IMPL,
  });
}

function showNewForm(req, res) {
  res.render("changes/new", { error: null, form: {} });
}

async function createChange(req, res) {
  try {
    const data = req.body;
    for (const field of ["title", "description", "riskLevel", "plannedDate", "requestedBy", "department"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const changeId = await generateSequentialId("CHG");

    const change = await Change.create({
      changeId,
      title: data.title,
      description: data.description,
      riskLevel: data.riskLevel,
      cabStatus: APPROVAL.PENDING,
      plannedDate: new Date(data.plannedDate),
      implementationStatus: IMPL.NOT_STARTED,
      requestedBy: data.requestedBy,
      department: data.department,
      createdBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Change",
      entityId: change._id,
      details: `${data.title} (${data.riskLevel} risk)`,
    });

    res.redirect(`/changes/${change._id}?created=1`);
  } catch (err) {
    res.status(400).render("changes/new", { error: err.message, form: req.body });
  }
}

async function showChange(req, res) {
  const change = await Change.findById(req.params.id).lean();
  if (!change) return res.status(404).render("errors/404");

  res.render("changes/detail", {
    change,
    APPROVAL,
    IMPL,
    justCreated: req.query.created === "1",
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

    change.title = data.title;
    change.description = data.description;
    change.riskLevel = data.riskLevel;
    change.plannedDate = new Date(data.plannedDate);

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

  res.redirect("/changes");
}

async function updateImplementationStatus(req, res) {
  try {
    const { implementationStatus } = req.body;
    const change = await Change.findById(req.params.id);
    if (!change) return res.status(404).render("errors/404");

    if (change.cabStatus !== APPROVAL.APPROVED) {
      throw new Error("This change has not been approved by CAB yet.");
    }

    change.implementationStatus = implementationStatus;
    await change.save();

    await logAudit({
      user: req.user._id,
      action: "Implementation Status",
      entityType: "Change",
      entityId: change._id,
      details: implementationStatus,
    });

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
