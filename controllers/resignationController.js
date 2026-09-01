/*************************************************************
 * resignationController.js — port of the Resignations + Exit
 * Interview sections of OnboardingEngine.gs.
 *
 * Deferred vs. the original (documented in MIGRATION.md, same
 * pattern as Phase 1/2's EmailEngine deferral): the No Dues
 * Certificate is normally generated and emailed automatically once
 * every clearance is done — there's no email provider or letter/PDF
 * generator wired up yet, so completion is recorded in the audit
 * log instead, same as every other "would have emailed someone"
 * point in this migration so far.
 *
 * Clearance updates (IT/Finance/HR/Manager/Admin) are all gated to
 * the HR team for now — the original split some of these across
 * IT-team/Admin-team self-service, but those still route through
 * the same updateResignationClearanceInternal(), and Finance/
 * Manager never had their own "team" concept in the original either
 * (only HR/IT/Admin do — see teamAccess.js). Once IT Clearance
 * (Phase 5) exists it can post to this same endpoint from its own
 * IT-team-gated screen.
 *************************************************************/
const Resignation = require("../models/Resignation");
const ExitInterview = require("../models/ExitInterview");
const Employee = require("../models/Employee");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { createChecklistIfMissing } = require("../utils/checklists");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { deactivateUserAccess } = require("../utils/provisioning");

const CLEARANCE_TYPES = ["it", "finance", "hr", "manager", "admin"];

async function listResignations(req, res) {
  const resignations = await Resignation.find().sort({ createdDate: -1 }).lean();
  res.render("resignations/list", { resignations, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("resignations/new", { error: null, form: {} });
}

async function createResignation(req, res) {
  try {
    const data = req.body;
    if (!data.employee) throw new Error("Employee is required.");
    if (!data.resignationDate) throw new Error("Resignation Date is required.");
    if (!data.lastWorkingDay) throw new Error("Last Working Day is required.");

    const noticePeriodDays = Math.round(
      (new Date(data.lastWorkingDay).getTime() - new Date(data.resignationDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const resignationId = await generateSequentialId("RES");
    const resignation = await Resignation.create({
      resignationId,
      employee: data.employee,
      department: data.department || "",
      resignationDate: data.resignationDate,
      lastWorkingDay: data.lastWorkingDay,
      noticePeriodDays,
      reason: data.reason || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Submit", entityType: "Resignation", entityId: resignation._id, details: data.employee });

    // Offboarding starts immediately, same as the original — no need to
    // wait until the last working day.
    await createChecklistIfMissing(CHECKLIST_TYPE.OFFBOARDING, data.employee, data.department || "", req.user._id);
    await createChecklistIfMissing(CHECKLIST_TYPE.ADMIN_OFFBOARDING, data.employee, data.department || "", req.user._id);

    res.redirect(`/resignations/${resignation._id}?message=Resignation Submitted Successfully`);
  } catch (err) {
    res.status(400).render("resignations/new", { error: err.message, form: req.body });
  }
}

async function showResignation(req, res) {
  const resignation = await Resignation.findById(req.params.id).lean();
  if (!resignation) return res.status(404).render("errors/404");

  const exitInterview = await ExitInterview.findOne({ resignationId: resignation.resignationId }).lean();

  res.render("resignations/detail", {
    resignation,
    exitInterview,
    CLEARANCE_TYPES,
    message: req.query.message || null,
  });
}

async function updateClearance(req, res) {
  try {
    const { type, status } = req.body;
    if (!CLEARANCE_TYPES.includes(type)) throw new Error(`Unknown clearance type: ${type}`);

    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).render("errors/404");

    resignation.clearances[type] = status;
    await resignation.save();

    await logAudit({
      user: req.user._id,
      action: "Clearance Update",
      entityType: "Resignation",
      entityId: resignation._id,
      details: `${type} -> ${status}`,
    });

    const allCleared = CLEARANCE_TYPES.every((t) => resignation.clearances[t] === "Cleared");

    let message = `${type.toUpperCase()} clearance updated to ${status}`;
    if (allCleared && resignation.status !== "Completed") {
      await completeResignation(resignation, req.user._id);
      message += " — all clearances complete, resignation finalized automatically.";
    }

    res.redirect(`/resignations/${resignation._id}?message=${encodeURIComponent(message)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

/**
 * Port of completeResignationInternal() — flips the matching Employee's
 * status to "Left" directly (not through the HR-gated employee update
 * flow), so it works no matter which team triggered the final clearance,
 * and still runs the same offboarding automation (deactivating the login).
 */
async function completeResignation(resignation, actorId) {
  resignation.status = "Completed";
  await resignation.save();

  const employee = await Employee.findOne({ name: new RegExp(`^${resignation.employee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (employee) {
    employee.status = Employee.EMPLOYEE_STATUS.LEFT;
    await employee.save();
    await deactivateUserAccess(employee, actorId);
  }

  await logAudit({
    user: actorId,
    action: "Complete",
    entityType: "Resignation",
    entityId: resignation._id,
    details: "All clearances complete — employee status set to Left.",
  });
}

function showExitInterviewForm(req, res) {
  res.render("resignations/exit-interview", { resignationId: req.params.id, error: null, form: {} });
}

async function submitExitInterview(req, res) {
  try {
    const data = req.body;
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).render("errors/404");

    if (!data.employee) throw new Error("Employee is required.");

    const interviewId = await generateSequentialId("EXIT");
    await ExitInterview.create({
      interviewId,
      resignationId: resignation.resignationId,
      employee: data.employee,
      primaryReason: data.primaryReason || "",
      satisfactionRating: data.satisfactionRating || undefined,
      wouldRecommend: data.wouldRecommend || "",
      managerFeedback: data.managerFeedback || "",
      suggestions: data.suggestions || "",
      conductedBy: req.user.email,
    });

    resignation.exitInterviewNotes = data.managerFeedback || resignation.exitInterviewNotes;
    await resignation.save();

    await logAudit({ user: req.user._id, action: "Submit", entityType: "Exit Interview", entityId: resignation._id, details: data.employee });

    res.redirect(`/resignations/${resignation._id}?message=Exit Interview Recorded Successfully`);
  } catch (err) {
    res.status(400).render("resignations/exit-interview", { resignationId: req.params.id, error: err.message, form: req.body });
  }
}

module.exports = {
  listResignations,
  showNewForm,
  createResignation,
  showResignation,
  updateClearance,
  showExitInterviewForm,
  submitExitInterview,
};
