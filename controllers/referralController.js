/*************************************************************
 * referralController.js — port of ReferralEngine.gs. Any employee
 * can refer a candidate for an open job posting ("referrals_submit",
 * every role by default); the recruitment team tracks status through
 * to hire and whether the referral reward has been paid
 * ("referrals_manage", Admin/Manager by default).
 *************************************************************/
const Referral = require("../models/Referral");
const JobPosting = require("../models/JobPosting");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { addCandidateInternal } = require("./recruitmentController");
const { hasPermission } = require("../utils/permissions");

async function showNewForm(req, res) {
  const jobs = await JobPosting.find({ status: JobPosting.JOB_STATUS.OPEN }).sort({ title: 1 }).lean();
  res.render("referrals/new", { jobs, error: null, form: {} });
}

async function submitReferral(req, res) {
  try {
    const data = req.body;
    if (!data.candidateName) throw new Error("Candidate Name is required.");
    if (!data.jobId) throw new Error("Job Posting is required.");

    const job = await JobPosting.findOne({ jobId: data.jobId });
    if (!job) throw new Error("Job posting not found.");

    const referrerName = req.user.name;
    const referralId = await generateSequentialId("REF");

    const referral = await Referral.create({
      referralId,
      referrer: referrerName,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail || "",
      jobId: data.jobId,
      jobTitle: job.title,
    });

    await logAudit({
      user: req.user._id,
      action: "Submit",
      entityType: "Referral",
      entityId: referral._id,
      details: `${referrerName} -> ${data.candidateName}`,
    });

    // Also drop the candidate straight into the ATS pipeline, so
    // recruitment doesn't have to re-enter the same info — see
    // recruitmentController.js's file header for why this calls the
    // internal, ungated version.
    await addCandidateInternal(
      {
        jobId: data.jobId,
        name: data.candidateName,
        email: data.candidateEmail || "",
        resumeLink: data.resumeLink || "",
        notes: `Referred by ${referrerName}`,
      },
      req.user._id
    );

    res.redirect("/referrals?message=" + encodeURIComponent("Referral Submitted Successfully — thanks for the recommendation!"));
  } catch (err) {
    const jobs = await JobPosting.find({ status: JobPosting.JOB_STATUS.OPEN }).sort({ title: 1 }).lean();
    res.status(400).render("referrals/new", { jobs, error: err.message, form: req.body });
  }
}

async function listMyReferrals(req, res) {
  const myReferrals = await Referral.find({ referrer: req.user.name }).sort({ submittedDate: -1 }).lean();
  const canManage = await hasPermission(req.user.role, "referrals_manage");

  let allReferrals = [];
  if (canManage) {
    allReferrals = await Referral.find().sort({ submittedDate: -1 }).lean();
  }

  res.render("referrals/index", {
    myReferrals,
    allReferrals,
    canManage,
    REWARD_STATUS: Referral.REWARD_STATUS,
    REFERRAL_STATUS: Referral.REFERRAL_STATUS,
    message: req.query.message || null,
  });
}

async function updateReferral(req, res) {
  const referral = await Referral.findById(req.params.id);
  if (!referral) return res.status(404).render("errors/404");

  const { status, rewardStatus } = req.body;
  if (status) referral.status = status;
  if (rewardStatus) referral.rewardStatus = rewardStatus;
  await referral.save();

  await logAudit({
    user: req.user._id,
    action: "Update",
    entityType: "Referral",
    entityId: referral._id,
    details: `${status || ""} ${rewardStatus || ""}`.trim(),
  });

  res.redirect("/referrals?message=Referral Updated Successfully");
}

module.exports = { showNewForm, submitReferral, listMyReferrals, updateReferral };
