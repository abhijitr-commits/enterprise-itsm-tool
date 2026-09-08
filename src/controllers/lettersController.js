/*************************************************************
 * lettersController.js — port of LetterEngine.gs. Company-format
 * Offer Letters, Appointment Letters, No Dues Certificates,
 * Relieving Letters, and Experience Letters — templates use
 * {{Placeholder}} tags merged with real candidate/employee data,
 * same mergeLetterTemplate() logic as the original. Templates are
 * plain text, editable by HR (settings-backed, see utils/settings.js),
 * same as the original's Script-Properties-backed template editor.
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
 *
 * PROFESSIONAL-FORMAT PASS (see itsm_architecture_comparison.md):
 * every default template below writes as a complete, formal HR letter
 * (subject line, full body, signature block) rather than a short
 * generic paragraph, and views/letters/view.ejs wraps the merged body
 * in an actual letterhead (logo, company name, Ref/Date line) instead
 * of a bare bordered box. The Ref number and Date shown on the printed
 * page come straight from the persisted Letter document (letterId /
 * generatedDate) — not from a merged placeholder — so they can never
 * drift from the record; templates therefore no longer need their own
 * {{TodayDate}}/Ref lines for that purpose (TodayDate is still merged
 * for any template an HR admin customizes to want it inline).
 *************************************************************/
const Letter = require("../models/Letter");
const { LETTER_TYPE } = require("../models/Letter");
const Candidate = require("../models/Candidate");
const Employee = require("../models/Employee");
const { getSetting, setSetting } = require("../utils/settings");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { markChecklistTaskDone } = require("../utils/checklists");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { isHRTeam } = require("../utils/teamAccess");

const DEFAULT_OFFER_LETTER_TEMPLATE = `Dear {{EmployeeName}},

Sub: Offer of Employment — {{Designation}}

We are pleased to offer you employment with Peppermint Robotics in the position of {{Designation}} in the {{Department}} department, based on the information provided by you and the discussions held during your interview process.

Your tentative date of joining is {{JoiningDate}}. Your compensation, benefits, and other terms of employment will be communicated to you separately and form part of this offer.

This offer is contingent upon the successful completion of your background verification and submission of the necessary documents on or before your date of joining.

Please indicate your acceptance of this offer by signing and returning a copy of this letter, or by replying to confirm, at the earliest.

We look forward to welcoming you to the team.

Warm regards,

For Peppermint Robotics


_________________________
HR Team`;

const DEFAULT_APPOINTMENT_LETTER_TEMPLATE = `Dear {{EmployeeName}},

Sub: Confirmation of Appointment — {{Designation}}

Further to your acceptance of our offer of employment, we are pleased to confirm your appointment as {{Designation}} in the {{Department}} department at Peppermint Robotics, with effect from {{JoiningDate}}.

Employee ID: {{EmployeeId}}

Your employment shall be governed by the company's HR policies, code of conduct, and the terms and conditions of employment communicated to you separately, as may be amended from time to time.

We welcome you to Peppermint Robotics and look forward to a long and mutually rewarding association.

Warm regards,

For Peppermint Robotics


_________________________
HR Team`;

const DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE = `NO DUES CERTIFICATE

This is to certify that {{EmployeeName}} (Employee ID: {{EmployeeId}}), who was associated with Peppermint Robotics in the {{Department}} department, separated from the services of the company with effect from {{LastWorkingDay}}.

As part of the full and final settlement process, the following departmental clearances have been completed:

  IT Clearance:        {{ITClearance}}
  Finance Clearance:   {{FinanceClearance}}
  HR Clearance:        {{HRClearance}}
  Manager Clearance:   {{ManagerClearance}}
  Admin Clearance:     {{AdminClearance}}

Based on the above, {{EmployeeName}} has no outstanding dues, pending asset returns, or unresolved financial or administrative obligations towards the company as on the date of this certificate.

This certificate is issued at the request of the employee for record and reference purposes.

For Peppermint Robotics


_________________________
HR Team`;

const DEFAULT_RELIEVING_LETTER_TEMPLATE = `Dear {{EmployeeName}},

Sub: Relieving from Services

Employee ID: {{EmployeeId}}

This is to confirm that {{EmployeeName}} was employed with Peppermint Robotics as {{Designation}} in the {{Department}} department from {{JoiningDate}} to {{LastWorkingDay}}, a total tenure of {{Tenure}}.

Based on your resignation and the completion of the requisite exit formalities, you are hereby relieved from the services of the company with effect from the close of business on {{LastWorkingDay}}.

All dues payable to you, if any, will be settled as per the company's full and final settlement process and applicable policy.

We place on record our appreciation for your contribution during your tenure with us, and we wish you success in all your future endeavors.

Warm regards,

For Peppermint Robotics


_________________________
HR Team`;

// New letter type this pass adds — distinct from the Relieving Letter
// (which is about being formally released from duty) and the No Dues
// Certificate (which is a clearance-status report): a neutral
// "TO WHOMSOEVER IT MAY CONCERN" tenure/role certificate, the document
// a departing employee's next employer actually asks for.
const DEFAULT_EXPERIENCE_LETTER_TEMPLATE = `TO WHOMSOEVER IT MAY CONCERN

Employee ID: {{EmployeeId}}

This is to certify that {{EmployeeName}} was employed with Peppermint Robotics from {{JoiningDate}} to {{LastWorkingDay}}, a period of {{Tenure}}.

During this tenure, {{EmployeeName}} held the position of {{Designation}} in the {{Department}} department. Based on our records, {{EmployeeName}}'s conduct and performance during the association were found to be satisfactory.

This certificate is issued at the request of {{EmployeeName}} for record and future reference, without prejudice.

We wish {{EmployeeName}} success in all future endeavors.

For Peppermint Robotics


_________________________
HR Team`;

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

/**
 * Human-readable tenure between two dates ("2 years 3 months", "4 months",
 * "1 year"), used by the Relieving and Experience letter templates. Both
 * callers now require a joining date and a last working day on the form,
 * so this is only ever called with two real dates — never returns an
 * empty string, which keeps "...a period of {{Tenure}}." grammatical.
 */
function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "less than a month";

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths} month${remMonths !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

/* ---------- TEMPLATES ---------- */

async function showTemplates(req, res) {
  const [offerLetter, appointmentLetter, noDuesCertificate, relievingLetter, experienceLetter] = await Promise.all([
    getSetting("OfferLetterTemplate", DEFAULT_OFFER_LETTER_TEMPLATE),
    getSetting("AppointmentLetterTemplate", DEFAULT_APPOINTMENT_LETTER_TEMPLATE),
    getSetting("NoDuesCertificateTemplate", DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE),
    getSetting("RelievingLetterTemplate", DEFAULT_RELIEVING_LETTER_TEMPLATE),
    getSetting("ExperienceLetterTemplate", DEFAULT_EXPERIENCE_LETTER_TEMPLATE),
  ]);
  res.render("letters/templates", {
    offerLetter,
    appointmentLetter,
    noDuesCertificate,
    relievingLetter,
    experienceLetter,
    message: req.query.message || null,
  });
}

async function saveTemplates(req, res) {
  await Promise.all([
    setSetting("OfferLetterTemplate", req.body.offerLetter || DEFAULT_OFFER_LETTER_TEMPLATE),
    setSetting("AppointmentLetterTemplate", req.body.appointmentLetter || DEFAULT_APPOINTMENT_LETTER_TEMPLATE),
    setSetting("NoDuesCertificateTemplate", req.body.noDuesCertificate || DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE),
    setSetting("RelievingLetterTemplate", req.body.relievingLetter || DEFAULT_RELIEVING_LETTER_TEMPLATE),
    setSetting("ExperienceLetterTemplate", req.body.experienceLetter || DEFAULT_EXPERIENCE_LETTER_TEMPLATE),
  ]);

  await logAudit({ user: req.user._id, action: "Save Letter Templates", entityType: "Setting" });

  res.redirect("/letters/templates?message=Letter Templates Saved Successfully");
}

/* ---------- GENERATE ---------- */

async function listLetters(req, res) {
  const letters = await Letter.find().sort({ generatedDate: -1 }).lean();
  res.render("letters/list", { letters, message: req.query.message || null });
}

// "Select a name and ready to go": offer/interview-stage candidates,
// so HR picks who to send an offer to instead of typing everything
// from scratch — selecting one auto-fills email/designation via the
// data-* attributes on the <option>s (see letters/offer-new.ejs).
// Shared by showOfferForm and generateOfferLetter's error re-render,
// so a validation error doesn't blow up on a missing `candidates` local.
function getOfferCandidateOptions() {
  return Candidate.find({ stage: { $in: ["Interview", "Offer", "Hired"] } })
    .sort({ name: 1 })
    .select("candidateId name email jobTitle")
    .lean();
}

// Same idea for the Appointment/Relieving/Experience Letter forms'
// Employee Directory dropdown. dateOfJoining/createdDate are selected
// too so the Relieving/Experience forms can auto-fill a real "Date of
// Joining" the moment an employee is picked (see relieving-new.ejs /
// experience-new.ejs) — falling back to createdDate for any employee
// record that predates the dateOfJoining field.
function getAppointmentEmployeeOptions() {
  return Employee.find().sort({ name: 1 }).select("employeeId name department designation dateOfJoining createdDate").lean();
}

async function showOfferForm(req, res) {
  const candidates = await getOfferCandidateOptions();

  res.render("letters/offer-new", {
    error: null,
    candidates,
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
      TodayDate: formatToday(),
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
    const candidates = await getOfferCandidateOptions();
    res.status(400).render("letters/offer-new", { error: err.message, candidates, form: req.body });
  }
}

async function showAppointmentForm(req, res) {
  const employees = await getAppointmentEmployeeOptions();

  res.render("letters/appointment-new", {
    error: null,
    employees,
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
      EmployeeId: data.employeeId || "",
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
    const employees = await getAppointmentEmployeeOptions();
    res.status(400).render("letters/appointment-new", { error: err.message, employees, form: req.body });
  }
}

// "Select a name and ready to go" for the Relieving Letter too — the
// Employee Directory was the only thing generating letters for exiting
// employees before now (via the auto-generated No Dues Certificate);
// this is the separate, formal "you worked here, this was your role,
// this was your last day" document a departing employee actually needs
// for a future employer's background check, distinct from the No Dues
// Certificate's clearance-status report.
async function showRelievingForm(req, res) {
  const employees = await getAppointmentEmployeeOptions();

  res.render("letters/relieving-new", {
    error: null,
    employees,
    form: {
      employeeName: req.query.employeeName || "",
      department: req.query.department || "",
      designation: req.query.designation || "",
      joiningDate: req.query.joiningDate || "",
      lastWorkingDay: req.query.lastWorkingDay || "",
      employeeId: req.query.employeeId || "",
    },
  });
}

async function generateRelievingLetter(req, res) {
  try {
    const data = req.body;
    if (!data.employeeName) throw new Error("Employee name is required.");
    if (!data.joiningDate) throw new Error("Date of joining is required.");
    if (!data.lastWorkingDay) throw new Error("Last working day is required.");

    const template = await getSetting("RelievingLetterTemplate", DEFAULT_RELIEVING_LETTER_TEMPLATE);
    const merged = mergeLetterTemplate(template, {
      EmployeeName: data.employeeName,
      EmployeeId: data.employeeId || "",
      Department: data.department || "",
      Designation: data.designation || "",
      JoiningDate: new Date(data.joiningDate).toLocaleDateString(),
      LastWorkingDay: new Date(data.lastWorkingDay).toLocaleDateString(),
      Tenure: formatDuration(data.joiningDate, data.lastWorkingDay),
      TodayDate: formatToday(),
    });

    const letterId = await generateSequentialId("LTR");
    const letter = await Letter.create({
      letterId,
      type: LETTER_TYPE.RELIEVING,
      recipientName: data.employeeName,
      content: merged,
      relatedId: data.employeeId || "",
      generatedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Relieving Letter Generated", entityType: "Letter", entityId: letter._id, details: data.employeeName });

    res.redirect(`/letters/${letter.letterId}`);
  } catch (err) {
    const employees = await getAppointmentEmployeeOptions();
    res.status(400).render("letters/relieving-new", { error: err.message, employees, form: req.body });
  }
}

// Experience Letter — same employee-picker pattern as Relieving, but a
// neutral tenure/role certificate ("TO WHOMSOEVER IT MAY CONCERN")
// rather than a formal release-from-duty notice. See the file-header
// comment for why this is a distinct document from both the Relieving
// Letter and the No Dues Certificate.
async function showExperienceForm(req, res) {
  const employees = await getAppointmentEmployeeOptions();

  res.render("letters/experience-new", {
    error: null,
    employees,
    form: {
      employeeName: req.query.employeeName || "",
      department: req.query.department || "",
      designation: req.query.designation || "",
      joiningDate: req.query.joiningDate || "",
      lastWorkingDay: req.query.lastWorkingDay || "",
      employeeId: req.query.employeeId || "",
    },
  });
}

async function generateExperienceLetter(req, res) {
  try {
    const data = req.body;
    if (!data.employeeName) throw new Error("Employee name is required.");
    if (!data.joiningDate) throw new Error("Date of joining is required.");
    if (!data.lastWorkingDay) throw new Error("Last working day is required.");

    const template = await getSetting("ExperienceLetterTemplate", DEFAULT_EXPERIENCE_LETTER_TEMPLATE);
    const merged = mergeLetterTemplate(template, {
      EmployeeName: data.employeeName,
      EmployeeId: data.employeeId || "",
      Department: data.department || "",
      Designation: data.designation || "",
      JoiningDate: new Date(data.joiningDate).toLocaleDateString(),
      LastWorkingDay: new Date(data.lastWorkingDay).toLocaleDateString(),
      Tenure: formatDuration(data.joiningDate, data.lastWorkingDay),
      TodayDate: formatToday(),
    });

    const letterId = await generateSequentialId("LTR");
    const letter = await Letter.create({
      letterId,
      type: LETTER_TYPE.EXPERIENCE,
      recipientName: data.employeeName,
      content: merged,
      relatedId: data.employeeId || "",
      generatedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Experience Letter Generated", entityType: "Letter", entityId: letter._id, details: data.employeeName });

    res.redirect(`/letters/${letter.letterId}`);
  } catch (err) {
    const employees = await getAppointmentEmployeeOptions();
    res.status(400).render("letters/experience-new", { error: err.message, employees, form: req.body });
  }
}

/**
 * INTERNAL — no permission check, called from resignationController.js
 * once every clearance is "Cleared" (port of the original's automatic
 * generateAndSendNoDuesCertificate(), minus the emailing). Best-effort
 * looks up the departing employee's directory record by exact name
 * match (same convention used throughout this app for free-text name
 * fields — see employeeController.js's asset-reassignment lookup) so
 * the certificate can carry a real Employee ID; silently leaves it
 * blank if no exact match is found rather than failing the offboarding
 * flow this is called from.
 */
async function generateNoDuesCertificateInternal(resignation, actorId) {
  const employeeRecord = await Employee.findOne({
    name: new RegExp(`^${String(resignation.employee || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  })
    .select("employeeId")
    .lean();

  const template = await getSetting("NoDuesCertificateTemplate", DEFAULT_NO_DUES_CERTIFICATE_TEMPLATE);
  const merged = mergeLetterTemplate(template, {
    EmployeeName: resignation.employee,
    EmployeeId: (employeeRecord && employeeRecord.employeeId) || "",
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
  showRelievingForm,
  generateRelievingLetter,
  showExperienceForm,
  generateExperienceLetter,
  generateNoDuesCertificateInternal,
  showLetter,
};
