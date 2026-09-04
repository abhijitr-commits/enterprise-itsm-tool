/*************************************************************
 * performanceController.js — port of PMSEngine.gs. Lightweight
 * performance management: goal tracking (with progress %) and
 * formal review cycles (rating + written feedback, acknowledged
 * by the employee). No 360-degree multi-rater feedback or
 * calibration — a heavier feature genuinely suited to a dedicated
 * PMS platform at larger scale, same scope note as the original.
 *
 * Creating goals/reviews stays HR-team-gated (requireHRTeam), same
 * as the original's requireHRTeam() calls — same team-based gate
 * Employee Directory management and Onboarding/Offboarding already
 * use. Updating a goal's progress and acknowledging a review use a
 * real OWNERSHIP check (only the employee it belongs to, or the HR
 * team) instead of a blanket permission — ported exactly from the
 * original's updateGoalProgress()/acknowledgeReview() logic, which
 * compares against the caller's own display name.
 *
 * Deferred vs. the original: notifying the employee by email when a
 * goal/review is created — no email provider yet (see MIGRATION.md);
 * recorded in the audit log instead, same as every other "would have
 * emailed someone" point in this migration.
 *************************************************************/
const Goal = require("../models/Goal");
const Review = require("../models/Review");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { isHRTeam } = require("../utils/teamAccess");

function sameName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/* ---------- GOALS ---------- */

async function listGoals(req, res) {
  const goals = await Goal.find().sort({ createdDate: -1 }).lean();
  res.render("performance/goals", {
    goals,
    isHR: isHRTeam(req.user),
    currentUserName: req.user.name,
    message: req.query.message || null,
  });
}

function showNewGoalForm(req, res) {
  res.render("performance/goal-new", { error: null, form: {} });
}

async function createGoal(req, res) {
  try {
    const data = req.body;
    if (!data.employee) throw new Error("Employee is required.");
    if (!data.goalTitle) throw new Error("Goal Title is required.");

    const goalId = await generateSequentialId("GOAL");
    const goal = await Goal.create({
      goalId,
      employee: data.employee,
      goalTitle: data.goalTitle,
      description: data.description || "",
      targetDate: data.targetDate || null,
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create Goal", entityType: "Goal", entityId: goal._id, details: `${data.employee} — ${data.goalTitle}` });

    res.redirect("/performance/goals?message=Goal Created Successfully");
  } catch (err) {
    res.status(400).render("performance/goal-new", { error: err.message, form: req.body });
  }
}

async function updateGoalProgress(req, res) {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).render("errors/404");

    // Real ownership check, ported from the original: only the employee
    // the goal belongs to (or the HR team) can update its progress.
    const isOwner = sameName(req.user.name, goal.employee);
    if (!isOwner && !isHRTeam(req.user)) {
      return res.status(403).render("errors/403", { action: `${goal.employee}'s goal progress` });
    }

    const progress = Math.max(0, Math.min(100, Number(req.body.progress) || 0));
    goal.progress = progress;
    goal.status = progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started";
    await goal.save();

    await logAudit({ user: req.user._id, action: "Goal Progress Update", entityType: "Goal", entityId: goal._id, details: `${progress}%` });

    res.redirect("/performance/goals?message=Goal Progress Updated");
  } catch (err) {
    res.status(400).send(err.message);
  }
}

/* ---------- REVIEWS ---------- */

async function listReviews(req, res) {
  const reviews = await Review.find().sort({ reviewDate: -1 }).lean();
  res.render("performance/reviews", {
    reviews,
    isHR: isHRTeam(req.user),
    currentUserName: req.user.name,
    message: req.query.message || null,
  });
}

function showNewReviewForm(req, res) {
  res.render("performance/review-new", { error: null, form: {} });
}

async function createReview(req, res) {
  try {
    const data = req.body;
    if (!data.employee) throw new Error("Employee is required.");
    if (!data.reviewPeriod) throw new Error("Review Period is required.");
    if (!data.rating) throw new Error("Rating is required.");

    const reviewId = await generateSequentialId("REV");
    const review = await Review.create({
      reviewId,
      employee: data.employee,
      reviewPeriod: data.reviewPeriod,
      reviewer: req.user.email,
      rating: data.rating,
      strengths: data.strengths || "",
      areasForImprovement: data.areasForImprovement || "",
    });

    await logAudit({ user: req.user._id, action: "Create Review", entityType: "Review", entityId: review._id, details: `${data.employee} — ${data.reviewPeriod}` });

    res.redirect("/performance/reviews?message=Review Submitted Successfully");
  } catch (err) {
    res.status(400).render("performance/review-new", { error: err.message, form: req.body });
  }
}

async function acknowledgeReview(req, res) {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).render("errors/404");

    if (!sameName(req.user.name, review.employee)) {
      return res.status(403).render("errors/403", { action: "acknowledge this review" });
    }

    review.status = "Acknowledged";
    await review.save();

    await logAudit({ user: req.user._id, action: "Acknowledged", entityType: "Review", entityId: review._id });

    res.redirect("/performance/reviews?message=Review Acknowledged");
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = {
  listGoals,
  showNewGoalForm,
  createGoal,
  updateGoalProgress,
  listReviews,
  showNewReviewForm,
  createReview,
  acknowledgeReview,
};
