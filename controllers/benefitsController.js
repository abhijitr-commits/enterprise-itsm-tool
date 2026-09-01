/*************************************************************
 * benefitsController.js — port of BenefitsEngine.gs. Benefits
 * Administration: tracks employee enrollment in company benefits
 * (health insurance, life insurance, retirement plans, etc.), not a
 * claims processing system, same scope note as the original.
 *
 * Every route here is HR-team gated (requireHRTeam), matching the
 * original's requireHRTeam() calls on enrollBenefit()/
 * getAllBenefitsSafe()/updateBenefitStatus() exactly — unlike Leave/
 * Recruitment/Goals, this list was never open-read in the original.
 * Self-service viewing happens through My Profile (see
 * profileController.js's "My Benefits" section), same as the
 * original's getMyBenefitsSafe().
 *
 * Deferred vs. the original: notifying the employee by email on
 * enrollment — no email provider yet (see MIGRATION.md); recorded in
 * the audit log instead.
 *************************************************************/
const BenefitEnrollment = require("../models/BenefitEnrollment");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listBenefits(req, res) {
  const enrollments = await BenefitEnrollment.find().sort({ enrollmentDate: -1 }).lean();
  res.render("benefits/list", { enrollments, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("benefits/new", { error: null, form: {} });
}

async function createEnrollment(req, res) {
  try {
    const data = req.body;
    if (!data.employee) throw new Error("Employee is required.");
    if (!data.benefitType) throw new Error("Benefit Type is required.");
    if (!data.planName) throw new Error("Plan Name is required.");

    const enrollmentId = await generateSequentialId("BEN");
    const enrollment = await BenefitEnrollment.create({
      enrollmentId,
      employee: data.employee,
      benefitType: data.benefitType,
      planName: data.planName,
      coverageDetails: data.coverageDetails || "",
      enrolledBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Enroll",
      entityType: "BenefitEnrollment",
      entityId: enrollment._id,
      details: `${data.employee} — ${data.benefitType} (${data.planName})`,
    });

    res.redirect("/benefits?message=Benefit Enrollment Recorded Successfully");
  } catch (err) {
    res.status(400).render("benefits/new", { error: err.message, form: req.body });
  }
}

async function updateStatus(req, res) {
  try {
    const enrollment = await BenefitEnrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).render("errors/404");

    enrollment.status = req.body.status;
    await enrollment.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "BenefitEnrollment", entityId: enrollment._id, details: req.body.status });

    res.redirect(`/benefits?message=${encodeURIComponent(`Status updated to ${req.body.status}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listBenefits, showNewForm, createEnrollment, updateStatus };
