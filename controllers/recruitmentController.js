/*************************************************************
 * recruitmentController.js — port of ATSEngine.gs. Lightweight
 * applicant tracking: job postings + a candidate pipeline with
 * stage tracking. Doesn't post to external job boards or parse
 * resumes — candidates are added manually as they apply.
 *
 * Bug fix vs. the original: addCandidate() there unconditionally
 * required "recruitment_manage", but ReferralEngine.gs's
 * submitReferral() (open to every role via "referrals_submit") calls
 * it directly to drop the referred candidate into the pipeline — so
 * in the original, a non-Manager/Admin's referral would silently
 * fail with a permission error AFTER the referral row was already
 * written, a confusing half-success. Here that's split into an
 * ungated addCandidateInternal() (used by both the guarded route
 * below and referralController.js) plus the permission check only on
 * the direct "add a candidate" route — the same public/internal split
 * already used for onboarding checklists (see utils/checklists.js).
 *************************************************************/
const JobPosting = require("../models/JobPosting");
const Candidate = require("../models/Candidate");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { createChecklistIfMissing } = require("../utils/checklists");
const { CHECKLIST_TYPE } = require("../models/Checklist");

async function listJobs(req, res) {
  const jobs = await JobPosting.find().sort({ postedDate: -1 }).lean();
  res.render("recruitment/jobs", { jobs, message: req.query.message || null });
}

function showNewJobForm(req, res) {
  res.render("recruitment/job-new", { error: null, form: {} });
}

async function createJob(req, res) {
  try {
    const data = req.body;
    if (!data.title) throw new Error("Title is required.");
    if (!data.department) throw new Error("Department is required.");

    const jobId = await generateSequentialId("JOB");
    const job = await JobPosting.create({
      jobId,
      title: data.title,
      department: data.department,
      description: data.description || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create Job Posting", entityType: "JobPosting", entityId: job._id, details: data.title });

    res.redirect("/recruitment?message=Job Posting Created Successfully");
  } catch (err) {
    res.status(400).render("recruitment/job-new", { error: err.message, form: req.body });
  }
}

async function closeJob(req, res) {
  const job = await JobPosting.findOne({ jobId: req.params.jobId });
  if (!job) return res.status(404).render("errors/404");

  job.status = JobPosting.JOB_STATUS.CLOSED;
  await job.save();

  await logAudit({ user: req.user._id, action: "Close Job Posting", entityType: "JobPosting", entityId: job._id });

  res.redirect("/recruitment?message=Job Posting Closed.");
}

async function listCandidates(req, res) {
  const job = await JobPosting.findOne({ jobId: req.params.jobId }).lean();
  if (!job) return res.status(404).render("errors/404");

  const candidates = await Candidate.find({ jobId: req.params.jobId }).sort({ appliedDate: -1 }).lean();

  res.render("recruitment/candidates", {
    job,
    candidates,
    STAGES: Candidate.CANDIDATE_STAGES,
    message: req.query.message || null,
  });
}

/**
 * INTERNAL — no permission check (see file header). Used by the
 * guarded addCandidate() route below AND by referralController.js.
 */
async function addCandidateInternal({ jobId, name, email, phone, resumeLink, notes }, actorId) {
  if (!name) throw new Error("Candidate Name is required.");
  if (!jobId) throw new Error("Job Posting is required.");

  const job = await JobPosting.findOne({ jobId });
  if (!job) throw new Error("Job posting not found.");

  const candidateId = await generateSequentialId("CAN");
  const candidate = await Candidate.create({
    candidateId,
    jobId,
    jobTitle: job.title,
    name,
    email: email || "",
    phone: phone || "",
    resumeLink: resumeLink || "",
    notes: notes || "",
  });

  await logAudit({ user: actorId, action: "Add Candidate", entityType: "Candidate", entityId: candidate._id, details: `${name} -> ${job.title}` });

  return candidate;
}

async function addCandidate(req, res) {
  try {
    await addCandidateInternal({ ...req.body, jobId: req.params.jobId }, req.user._id);
    res.redirect(`/recruitment/${req.params.jobId}/candidates?message=Candidate Added Successfully`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

/**
 * Port of updateCandidateStage() — moving a candidate to "Hired"
 * automatically starts the Pre-Onboarding checklist (the actual
 * Employee record is still created manually by HR, a deliberate
 * decision point, same as the original).
 */
async function updateCandidateStage(req, res) {
  try {
    const { stage } = req.body;
    if (!Candidate.CANDIDATE_STAGES.includes(stage)) throw new Error(`Invalid stage: ${stage}`);

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).render("errors/404");

    candidate.stage = stage;
    await candidate.save();

    await logAudit({ user: req.user._id, action: "Stage Update", entityType: "Candidate", entityId: candidate._id, details: stage });

    if (stage === "Hired") {
      const job = await JobPosting.findOne({ jobId: candidate.jobId }).lean();
      await createChecklistIfMissing(CHECKLIST_TYPE.PRE_ONBOARDING, candidate.name, job ? job.department : "", req.user._id);
    }

    res.redirect(`/recruitment/${candidate.jobId}/candidates?message=${encodeURIComponent(`Candidate moved to ${stage}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = {
  listJobs,
  showNewJobForm,
  createJob,
  closeJob,
  listCandidates,
  addCandidate,
  addCandidateInternal,
  updateCandidateStage,
};
