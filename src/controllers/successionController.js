/*************************************************************
 * successionController.js — port of SuccessionEngine.gs. Tracks key
 * roles, their current holder, and who's lined up to take over —
 * genuinely sensitive HR data (naming who's a backup for whom), so
 * every route is gated Admin/Manager only, no employee-self-service
 * at all (unlike Goals/Reviews, which have an ownership escape hatch).
 *
 * Bug fix vs. the original (see MIGRATION.md and config/permissions.js):
 * every function in SuccessionEngine.gs called requirePermission(
 * "view_reports"), a permission key that was never actually defined
 * in DEFAULT_PERMISSIONS_MAP anywhere (the real key everywhere else is
 * "reports_view") — so hasPermission() always fell through to its
 * "unknown permission key" default of false, for EVERY role including
 * Administrator, meaning Succession Planning was permanently
 * inaccessible in the original tool. This uses a new, correctly-wired
 * "succession_manage" key instead of silently reusing "reports_view"
 * (reusing it would incorrectly couple two unrelated Permission Matrix
 * rows — unchecking Reports for a Manager shouldn't also lock them out
 * of succession plans).
 *************************************************************/
const SuccessionPlan = require("../models/SuccessionPlan");
const { READINESS_LEVELS } = require("../models/SuccessionPlan");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listPlans(req, res) {
  const plans = await SuccessionPlan.find().sort({ position: 1 }).lean();
  res.render("succession/list", { plans, READINESS_LEVELS, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("succession/new", { READINESS_LEVELS, error: null, form: {} });
}

async function createPlan(req, res) {
  try {
    const data = req.body;
    if (!data.position) throw new Error("Position/Role is required.");
    if (!data.currentHolder) throw new Error("Current Holder is required.");

    const planId = await generateSequentialId("SUCC");
    const plan = await SuccessionPlan.create({
      planId,
      position: data.position,
      currentHolder: data.currentHolder,
      department: data.department || "",
      successor1: data.successor1 || "",
      successor1Readiness: data.successor1Readiness || "",
      successor2: data.successor2 || "",
      successor2Readiness: data.successor2Readiness || "",
      notes: data.notes || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "SuccessionPlan", entityId: plan._id, details: data.position });

    res.redirect("/succession?message=Succession Plan Created Successfully");
  } catch (err) {
    res.status(400).render("succession/new", { READINESS_LEVELS, error: err.message, form: req.body });
  }
}

async function showEditForm(req, res) {
  const plan = await SuccessionPlan.findById(req.params.id).lean();
  if (!plan) return res.status(404).render("errors/404");
  res.render("succession/edit", { plan, READINESS_LEVELS, error: null });
}

async function updatePlan(req, res) {
  try {
    const plan = await SuccessionPlan.findById(req.params.id);
    if (!plan) return res.status(404).render("errors/404");

    const data = req.body;
    if (!data.position) throw new Error("Position/Role is required.");
    if (!data.currentHolder) throw new Error("Current Holder is required.");

    plan.position = data.position;
    plan.currentHolder = data.currentHolder;
    plan.department = data.department || "";
    plan.successor1 = data.successor1 || "";
    plan.successor1Readiness = data.successor1Readiness || "";
    plan.successor2 = data.successor2 || "";
    plan.successor2Readiness = data.successor2Readiness || "";
    plan.notes = data.notes || "";
    await plan.save();

    await logAudit({ user: req.user._id, action: "Update", entityType: "SuccessionPlan", entityId: plan._id, details: data.position });

    res.redirect("/succession?message=Succession Plan Updated Successfully");
  } catch (err) {
    res.status(400).render("succession/edit", { plan: { ...req.body, _id: req.params.id }, READINESS_LEVELS, error: err.message });
  }
}

module.exports = { listPlans, showNewForm, createPlan, showEditForm, updatePlan };
