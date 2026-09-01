/*************************************************************
 * lettersController.js — port of LetterEngine.gs. Company-format
 * Offer Letters, Appointment Letters, and No Dues Certificates —
 * templates use {{Placeholder}} tags merged with real candidate/
 * employee data, same mergeLetterTemplate() logic as the original.
 * Templates are plain text, editable by HR (settings-backed, see
 * utils/settings.js), same as the original's Script-Properties-backed
 * template editor.
 *
 * Every generate/manage route is HR-team gated (requireHRTeam), same
 * as the original's requireHRTeam() calls throughout LetterEngine.gs.
 *
 * DEVIATION vs. the original: the original emailed the merged letter
 * directly (MailApp.sendEmail) and never stored it anywhere else —
 * the email inbox WAS the record. With no email provider yet (see
 * MIGRATION.md), every generated letter is saved to the Letter
 * collection instead and rendered as a printable page
 * (views/letters/view.ejs) — same "record instead of emailing"
 * substitution used everywhere else in this migration, just with a
 * full persisted copy (see models/Letter.js's own comment for why).
 * Generating an Offer Letter still auto-checks off the "Offer Letter
 * Sent" Pre-Onboarding task, same as the original's sendOfferLetter().
 *************************************************************/
const Letter = require("../models/Letter");
const { LETTER_TYPE } = require("../models/Letter");
const { getSetting, setSetting } = require("../utils/settings");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { markChecklistTaskDone } = require("../utils/checklists");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { isHRTeam } = require("../utils/teamAccess");

const DEFAULT_OFFER_LETTER_TEMPLATE = `Dear {{EmployeeName}},

We are pleased to offer you the position of {{Designation}} in the {{Department}} department at Peppermint Robotics.

Your tentative joining date is {{JoiningDate}}.

Please review the attached terms and reply to confirm your acceptance of this offer.

Warm regards,
HR Team
Peppermint Robotics`;

const DEFAULT_APPOINTMENT_LETTER_TEMPLATE = `APPOINTMENT LETTER

Date: {{TodayDate}}

Dear {{EmployeeName}},

Further to your acceptance of our offer, we are pleased to confirm your appointment as {{Designation}} in the {{Department}} department at Peppermint Robotics, effective {{JoiningDate}}.

This letter confirms your appointment subject to the company's policies and terms of employment communicated to you separately.

We look forward to having you on the team.

Warm regards,
HR Team
Peppermint Robotics`;

const DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE = `NO DUES CERTIFICATE

Date: {{TodayDate}}

This is to certify that {{EmployeeName}} (Department: {{Department}}), who resigned from Peppermint Robotics with a last working day of {{LastWorkingDay}}, has completed full clearance across all departments as follows:

IT Clearance: {{ITClearance}}
Finance Clearance: {{FinanceClearance}}
HR Clearance: {{HRClearance}}
Manager Clearance: {{ManagerClearance}}
Admin Clearance: {{AdminClearance}}

{{EmployeeName}} has no outstanding dues, pending asset returns, or unresolved obligations with the company as of the date of this certificate.

This certificate is issued for record purposes.

HR Team
Peppermint Robotics`;

/** Port of mergeLetterTemplate() — unknown placeholders are left as-is rather than silently vanishing, so a typo'd template tag is obvious instead of hidden. */
function mergeLetterTemplate(template, data) {
  let result = template;
  for (const key of Object.keys(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), data[key] || "");
  }
  return result;
}

function formatToday() {
  return new Date().toLocaleDateString();
}

/* ---------- TEMPLATES ---------- */

async function showTemplates(req, res) {
  const [offerLetter, appointmentLetter, noDuesCertificate] = await Promise.all([
    getSetting("OfferLetterTemplate", DEFAULT_OFFER_LETTER_TEMPLATE),
    getSetting("AppointmentLetterTemplate", DEFAULT_APPOINTMENT_LETTER_TEMPLATE),
    getSetting("NoDuesCertificateTemplate", DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE),
  ]);
  res.render("letters/templates", { offerLetter, appointmentLetter, noDuesCertificate, message: req.query.message || null });
}

async function saveTemplates(req, res) {
  await Promise.all([
    setSetting("OfferLetterTemplate", req.body.offerLetter || DEFAULT_OFFER_LETTER_TEMPLATE),
    setSetting("AppointmentLetterTemplate", req.body.appointmentLetter || DEFAULT_APPOINTMENT_LETTER_TEMPLATE),
    setSetting("NoDuesCertificateTemplate", req.body.noDuesCertificate || DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE),
  ]);

  await logAudit({ user: req.user._id, action: "Save Letter Templates", entityType: "Setting" });

  res.redirect("/letters/templates?message=Letter Templates Saved Successfully");
}

/* ---------- GENERATE ---------- */

async function listLetters(req, res) {
  const letters = await Letter.find().sort({ generatedDate: -1 }).lean();
  res.render("letters/list", { letters, message: req.query.message || null });
}

function showOfferForm(req, res) {
  res.render("letters/offer-new", {
    error: null,
    form: {
      candidateName: req.query.candidateName || "",
      candidateEmail: req.query.candidateEmail || "",
      department: req.query.department || "",
      designation: req.query.designation || "",
      joiningDate: req.query.joiningDate || "",
      candidateId: req.query.candidateId || "",
    },
  });
}

async function generateOfferLetter(req, res) {
  try {
    const data = req.body;
    if (!data.candidateName) throw new Error("Candidate name is required.");
    if (!data.candidateEmail) throw new Error("Candidate email is required.");

    const template = await getSetting("OfferLetterTemplate", DEFAULT_OFFER_LETTER_TEMPLATE);
    const merged = mergeLetterTemplate(template, {
      EmployeeName: data.candidateName,
      Department: data.department || "",
      Designation: data.designation || "",
      JoiningDate: data.joiningDate || "TBD",
    });

    const letterId = await generateSequentialId("LTR");
    const letter = await Letter.create({
      letterId,
      type: LETTER_TYPE.OFFER,
      recipientName: data.candidateName,
      recipientEmail: data.candidateEmail,
      content: merged,
      relatedId: data.candidateId || "",
      generatedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Offer Letter Generated", entityType: "Letter", entityId: letter._id, details: data.candidateName });

    await markChecklistTaskDone(CHECKLIST_TYPE.PRE_ONBOARDING, data.candidateName, "Offer Letter Sent", req.user._id);

    res.redirect(`/letters/${letter.letterId}`);
  } catch (err) {
    res.status(400).render("letters/offer-new", { error: err.message, form: req.body });
  }
}

function showAppointmentForm(req, res) {
  res.render("letters/appointment-new", {
    error: null,
    form: {
      employeeName: req.query.employeeName || "",
      department: req.query.department || "",
      designation: req.query.designation || "",
      joiningDate: req.query.joiningDate || "",
      employeeId: req.query.employeeId || "",
    },
  });
}

async function generateAppointmentLetter(req, res) {
  try {
    const data = req.body;
    if (!data.employeeName) throw new Error("Employee name is required.");

    const template = await getSetting("AppointmentLetterTemplate", DEFAULT_APPOINTMENT_LETTER_TEMPLATE);
    const merged = mergeLetterTemplate(template, {
      EmployeeName: data.employeeName,
      Department: data.department || "",
      Designation: data.designation || "",
      JoiningDate: data.joiningDate || "TBD",
      TodayDate: formatToday(),
    });

    const letterId = await generateSequentialId("LTR");
    const letter = await Letter.create({
      letterId,
      type: LETTER_TYPE.APPOINTMENT,
      recipientName: data.employeeName,
      content: merged,
      relatedId: data.employeeId || "",
      generatedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Appointment Letter Generated", entityType: "Letter", entityId: letter._id, details: data.employeeName });

    res.redirect(`/letters/${letter.letterId}`);
  } catch (err) {
    res.status(400).render("letters/appointment-new", { error: err.message, form: req.body });
  }
}

/**
 * INTERNAL — no permission check, called from resignationController.js
 * once every clearance is "Cleared" (port of the original's automatic
 * generateAndSendNoDuesCertificate(), minus the emailing).
 */
async function generateNoDuesCertificateInternal(resignation, actorId) {
  const template = await getSetting("NoDuesCertificateTemplate", DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE);
  const merged = mergeLetterTemplate(template, {
    EmployeeName: resignation.employee,
    Department: resignation.department || "",
    LastWorkingDay: resignation.lastWorkingDay ? new Date(resignation.lastWorkingDay).toLocaleDateString() : "",
    TodayDate: formatToday(),
    ITClearance: resignation.clearances.it,
    FinanceClearance: resignation.clearances.finance,
    HRClearance: resignation.clearances.hr,
    ManagerClearance: resignation.clearances.manager,
    AdminClearance: resignation.clearances.admin,
  });

  const letterId = await generateSequentialId("LTR");
  const letter = await Letter.create({
    letterId,
    type: LETTER_TYPE.NO_DUES,
    recipientName: resignation.employee,
    content: merged,
    relatedId: resignation.resignationId,
    generatedBy: "system",
  });

  await logAudit({ user: actorId, action: "No Dues Certificate Generated", entityType: "Letter", entityId: letter._id, details: resignation.employee });

  return letter;
}

/**
 * Viewing a single letter is self-or-HR-team, same ownership boundary
 * as training/showCertificate — the candidate/employee it was
 * generated for can view/print their own copy; HR can view any.
 * Candidates without a login can't reach this at all (requireLogin
 * on the whole router), same limitation as everything else that
 * would otherwise need a public/anonymous link.
 */
async function showLetter(req, res) {
  const letter = await Letter.findOne({ letterId: req.params.letterId }).lean();
  if (!letter) return res.status(404).render("errors/404");

  const isOwner = String(req.user.name || "").trim().toLowerCase() === String(letter.recipientName || "").trim().toLowerCase();
  if (!isOwner && !isHRTeam(req.user)) {
    return res.status(403).render("errors/403", { action: "view this letter" });
  }

  res.render("letters/view", { letter });
}

module.exports = {
  showTemplates,
  saveTemplates,
  listLetters,
  showOfferForm,
  generateOfferLetter,
  showAppointmentForm,
  generateAppointmentLetter,
  generateNoDuesCertificateInternal,
  showLetter,
};
