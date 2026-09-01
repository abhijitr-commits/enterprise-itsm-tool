/*************************************************************
 * profileController.js — port of ProfileEngine.gs. Self-service hub
 * pulling together everything about the LOGGED-IN user: their
 * directory record, assigned assets, and onboarding checklist
 * progress (if they're a new hire). Nothing is stored here — it's
 * purely an aggregator over other collections, same as the original.
 *
 * Leave balances are wired up as of Phase 4B (see utils/leaveBalances.js).
 * Trainings are still a placeholder until Phase 4D (LMS) exists — the
 * original pulled that from getMyTrainingsSafe(), which has no Node
 * equivalent yet. The profile page shows an honest "not available yet"
 * note for that section instead of silently omitting it.
 *************************************************************/
const Employee = require("../models/Employee");
const Asset = require("../models/Asset");
const ChecklistItem = require("../models/Checklist");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { getAllLeaveBalances } = require("../utils/leaveBalances");

async function showMyProfile(req, res) {
  const me = await Employee.findOne({ email: req.user.email.toLowerCase().trim() }).lean();

  if (!me) {
    return res.render("profile/index", {
      linked: false,
      profile: null,
      assets: [],
      onboardingTasks: [],
      leaveBalances: null,
    });
  }

  const [assets, onboardingTasks, leaveBalances] = await Promise.all([
    Asset.find({ assignedTo: new RegExp(`^${me.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean(),
    ChecklistItem.find({ type: CHECKLIST_TYPE.ONBOARDING, employee: me.name }).sort({ createdAt: 1 }).lean(),
    getAllLeaveBalances(me.name),
  ]);

  res.render("profile/index", {
    linked: true,
    profile: me,
    assets,
    onboardingTasks,
    leaveBalances,
  });
}

module.exports = { showMyProfile };
