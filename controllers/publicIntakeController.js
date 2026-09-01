/*************************************************************
 * publicIntakeController.js — port of PublicIntake.html +
 * Navigation.gs's doGet(public=true) branch + IncidentEngine.gs's
 * createPublicIncident(). A no-login incident submission form for
 * people outside the organization (or without an account) — served
 * standalone, without the app's sidebar/nav, same as the original's
 * "no internal Index.html shell" choice.
 *
 * Same three layers of spam protection as the original, in the same
 * order, since IncidentEngine.gs's own header comment flagged this
 * form as needing them if the link ever gets shared widely:
 *   1. Honeypot ("website" field, hidden from real visitors via CSS —
 *      a filled-in value silently "succeeds" without creating
 *      anything, so a bot never learns its submission was rejected).
 *   2. A dynamic math CAPTCHA, correct answer cached server-side
 *      under a one-time token (see models/CaptchaChallenge.js) —
 *      never trust a client-supplied "expected answer".
 *   3. A crude global rate limit (20 submissions / 10 minutes) —
 *      same limitation as the original: no reliable way to see a
 *      visitor's real IP for per-IP throttling, so it's a blunt
 *      global counter, not a per-visitor one.
 *
 * Deviation from the original: it alerted managers by emailing them
 * ("public-form tickets aren't triaged by a Service Desk agent on
 * the way in"). No email provider here (see MIGRATION.md), but as
 * of Phase 5E this app CAN post to Slack/Teams — so that's the
 * substitute, a genuine upgrade over "audit-log only" since the
 * infrastructure to actually alert someone now exists.
 *************************************************************/
const crypto = require("crypto");
const Incident = require("../models/Incident");
const CaptchaChallenge = require("../models/CaptchaChallenge");
const PublicFormSubmission = require("../models/PublicFormSubmission");
const { STATUS, PRIORITY } = require("../config/constants");
const { generateSequentialId } = require("../utils/idGenerator");
const { calculateSLADue } = require("../utils/sla");
const { logAudit } = require("../utils/auditLog");
const { notifyChannels } = require("../utils/notifications");

const RATE_LIMIT_MAX = 20; // per 10-minute window, same as the original

async function newChallenge() {
  const num1 = Math.floor(Math.random() * 8) + 1;
  const num2 = Math.floor(Math.random() * 8) + 1;
  const token = crypto.randomUUID();
  await CaptchaChallenge.create({ token, num1, num2 });
  return { token, num1, num2 };
}

async function showForm(req, res) {
  const challenge = await newChallenge();
  res.render("public/intake", {
    PRIORITY,
    challenge,
    error: null,
    submitted: false,
    incidentId: null,
    form: {},
  });
}

async function submitForm(req, res) {
  const data = req.body;

  // 1. HONEYPOT — real visitors never see or fill this field (see
  // views/public/intake.ejs). Pretend success; create nothing.
  if (data.website) {
    return res.render("public/intake", { PRIORITY, challenge: null, error: null, submitted: true, incidentId: null, form: {} });
  }

  const rerenderWithFreshChallenge = async (error) => {
    const challenge = await newChallenge();
    res.status(400).render("public/intake", { PRIORITY, challenge, error, submitted: false, incidentId: null, form: data });
  };

  // 2. CAPTCHA — the correct answer lives server-side against the
  // token, never trust data.captchaAnswer's own "expected" value.
  const existing = await CaptchaChallenge.findOne({ token: data.captchaToken });

  if (!existing) {
    return rerenderWithFreshChallenge("Your session expired — please try again.");
  }

  if (String(data.captchaAnswer || "").trim() !== String(existing.num1 + existing.num2)) {
    // Wrong answer: let them retry the SAME question rather than
    // silently swapping it out from under them.
    return res.status(400).render("public/intake", {
      PRIORITY,
      challenge: { token: existing.token, num1: existing.num1, num2: existing.num2 },
      error: "Incorrect answer to the verification question. Please try again.",
      submitted: false,
      incidentId: null,
      form: data,
    });
  }

  await CaptchaChallenge.deleteOne({ _id: existing._id }); // one-time use, prevent replay

  // 3. RATE LIMIT
  const recentCount = await PublicFormSubmission.countDocuments();
  if (recentCount >= RATE_LIMIT_MAX) {
    return rerenderWithFreshChallenge("Too many submissions right now — please try again in a few minutes.");
  }

  if (!data.reporterName || !data.subject || !data.description) {
    return rerenderWithFreshChallenge("Please fill in your name, subject, and description.");
  }

  await PublicFormSubmission.create({});

  const incidentId = await generateSequentialId("INC");
  const createdDate = new Date();
  const priority = Object.values(PRIORITY).includes(data.priority) ? data.priority : PRIORITY.MEDIUM;
  const slaDue = await calculateSLADue("Incident", createdDate, priority);

  const incident = await Incident.create({
    incidentId,
    createdDate,
    employeeName: data.reporterName,
    department: data.department || "External",
    location: data.location || "Other",
    category: data.category || "Other",
    priority,
    subject: data.subject,
    description: data.description,
    status: STATUS.OPEN,
    slaDue,
    createdBy: `Public Form (${data.reporterEmail || "no email given"})`,
  });

  await logAudit({
    action: "Create via Public Form",
    entityType: "Incident",
    entityId: incident._id,
    details: data.subject,
  });

  // Alert managers immediately — public-form tickets aren't triaged by
  // a Service Desk agent on the way in, same reasoning as the original.
  // Silently a no-op if no Slack/Teams webhook is configured yet
  // (see utils/notifications.js) — never blocks the submission either way.
  notifyChannels(
    `[Public Form] New Incident: ${incidentId}`,
    `${data.subject}\n\nReported by: ${data.reporterName} (${data.reporterEmail || "no email given"})\nPriority: ${priority}\n\n${data.description}`
  ).catch(() => {});

  res.render("public/intake", { PRIORITY, challenge: null, error: null, submitted: true, incidentId, form: {} });
}

module.exports = { showForm, submitForm };
