/*************************************************************
 * wellnessController.js — port of WellnessEngine.gs's three
 * lightweight engagement pieces:
 * - Wellness Programs: a calendar of events (physical/mental/
 *   financial/social wellness), viewable by everyone, creation
 *   gated to "wellness_manage" (Admin/Manager).
 * - Pulse Surveys: single-question quick surveys, answered
 *   ANONYMOUSLY by design (no employee/user field is ever stored
 *   against a response — matches the original exactly); creating a
 *   survey and viewing results are both gated ("wellness_manage" /
 *   "reports_view" respectively, same split the original used).
 * - Kudos: peer-to-peer recognition wall, giving is gated to
 *   "kudos_give" (every role, by default) and the wall itself is
 *   open to everyone (matches the original's getAllKudosSafe(), no
 *   permission check).
 *
 * Deferred vs. the original: notifying the Kudos recipient by email
 * — no email provider yet; recorded in the audit log instead.
 *************************************************************/
const WellnessProgram = require("../models/WellnessProgram");
const PulseSurvey = require("../models/PulseSurvey");
const PulseResponse = require("../models/PulseResponse");
const Kudos = require("../models/Kudos");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

/* ---------- WELLNESS PROGRAMS ---------- */

async function listPrograms(req, res) {
  const programs = await WellnessProgram.find().sort({ date: 1 }).lean();
  res.render("wellness/programs", { programs, message: req.query.message || null });
}

function showNewProgramForm(req, res) {
  res.render("wellness/program-new", { error: null, form: {} });
}

async function createProgram(req, res) {
  try {
    const data = req.body;
    if (!data.title) throw new Error("Title is required.");

    const programId = await generateSequentialId("WEL");
    const program = await WellnessProgram.create({
      programId,
      title: data.title,
      type: data.type || "General",
      date: data.date || null,
      description: data.description || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create Program", entityType: "WellnessProgram", entityId: program._id, details: data.title });

    res.redirect("/wellness/programs?message=Wellness Program Added Successfully");
  } catch (err) {
    res.status(400).render("wellness/program-new", { error: err.message, form: req.body });
  }
}

/* ---------- PULSE SURVEYS ---------- */

async function showPulse(req, res) {
  const survey = await PulseSurvey.findOne({ status: "Open" }).sort({ createdDate: -1 }).lean();
  res.render("wellness/pulse", { survey, submitted: req.query.submitted === "1", error: null });
}

function showNewSurveyForm(req, res) {
  res.render("wellness/pulse-new", { error: null, form: {} });
}

async function createSurvey(req, res) {
  try {
    if (!req.body.question) throw new Error("Question is required.");

    const surveyId = await generateSequentialId("PULSE");
    const survey = await PulseSurvey.create({ surveyId, question: req.body.question, createdBy: req.user.email });

    await logAudit({ user: req.user._id, action: "Create Pulse Survey", entityType: "PulseSurvey", entityId: survey._id, details: req.body.question });

    res.redirect("/wellness/pulse/results?message=Pulse Survey Created Successfully");
  } catch (err) {
    res.status(400).render("wellness/pulse-new", { error: err.message, form: req.body });
  }
}

/** Submitting a response is deliberately anonymous — no req.user field is ever written to the PulseResponse document. */
async function submitResponse(req, res) {
  try {
    const { surveyId, rating, comment } = req.body;
    if (!surveyId) throw new Error("Survey ID is required.");
    if (!rating) throw new Error("Rating is required.");

    const responseId = await generateSequentialId("PRESP");
    await PulseResponse.create({ responseId, surveyId, rating, comment: comment || "" });

    res.redirect("/wellness/pulse?submitted=1");
  } catch (err) {
    const survey = await PulseSurvey.findOne({ surveyId: req.body.surveyId }).lean();
    res.status(400).render("wellness/pulse", { survey, submitted: false, error: err.message });
  }
}

/**
 * There was previously no way to ever close a Pulse Survey — once
 * created it stayed "Open" forever and showPulse() kept serving it to
 * every employee indefinitely, since nothing in this file or
 * wellnessRoutes.js ever set status to "Closed". Gated the same as
 * creating a survey ("wellness_manage").
 */
async function closeSurvey(req, res) {
  const survey = await PulseSurvey.findById(req.params.id);
  if (!survey) return res.status(404).render("errors/404");

  survey.status = "Closed";
  await survey.save();

  await logAudit({ user: req.user._id, action: "Close Pulse Survey", entityType: "PulseSurvey", entityId: survey._id, details: survey.question });

  res.redirect("/wellness/pulse/results?message=Pulse Survey Closed");
}

async function pulseResults(req, res) {
  const surveys = await PulseSurvey.find().sort({ createdDate: -1 }).lean();

  const results = await Promise.all(
    surveys.map(async (s) => {
      const responses = await PulseResponse.find({ surveyId: s.surveyId }).lean();
      const count = responses.length;
      const average = count > 0 ? (responses.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1) : 0;
      const comments = responses.filter((r) => r.comment).map((r) => r.comment);
      return { survey: s, average, count, comments };
    })
  );

  res.render("wellness/pulse-results", { results, message: req.query.message || null });
}

/* ---------- KUDOS ---------- */

async function listKudos(req, res) {
  const kudosList = await Kudos.find().sort({ date: -1 }).lean();
  res.render("wellness/kudos", { kudosList, error: null, message: req.query.message || null });
}

async function giveKudos(req, res) {
  try {
    const { to, message } = req.body;
    if (!to) throw new Error("Recipient is required.");
    if (!message) throw new Error("Message is required.");

    const kudosId = await generateSequentialId("KUDOS");
    const kudos = await Kudos.create({ kudosId, from: req.user.name, to, message });

    await logAudit({ user: req.user._id, action: "Give Kudos", entityType: "Kudos", entityId: kudos._id, details: `${req.user.name} -> ${to}` });

    res.redirect("/wellness/kudos?message=Kudos sent!");
  } catch (err) {
    const kudosList = await Kudos.find().sort({ date: -1 }).lean();
    res.status(400).render("wellness/kudos", { kudosList, error: err.message, message: null });
  }
}

module.exports = {
  listPrograms,
  showNewProgramForm,
  createProgram,
  showPulse,
  showNewSurveyForm,
  createSurvey,
  submitResponse,
  closeSurvey,
  pulseResults,
  listKudos,
  giveKudos,
};
