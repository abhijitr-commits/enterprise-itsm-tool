/*************************************************************
 * profileController.js — port of ProfileEngine.gs. Self-service hub
 * pulling together everything about the LOGGED-IN user: their
 * directory record, assigned assets, and onboarding checklist
 * progress (if they're a new hire). Nothing is stored here — it's
 * purely an aggregator over other collections, same as the original.
 *
 * Leave balances and Trainings are placeholders until Phase 4B
 * (Leave/Attendance/Shift) and Phase 4D (LMS) exist — the original
 * pulled those from getAllLeaveBalancesSafe()/getMyTrainingsSafe(),
 * neither of which has a Node equivalent yet. The profile page shows
 * an honest "not available yet" note for those sections instead of
 * silently omitting them.
 *************************************************************/
const Employee = require("../models/Employee");
const Asset = require("../models/Asset");
const ChecklistItem = require("../models/Checklist");
const { CHECKLIST_TYPE } = require("../models/Checklist");

async function showMyProfile(req, res) {
  const me = await Employee.findOne({ email: req.user.email.toLowerCase().trim() }).lean();

  if (!me) {
    return res.render("profile/index", {
      linked: false,
      profile: null,
      assets: [],
      onboardingTasks: [],
    });
  }

  const [assets, onboardingTasks] = await Promise.all([
    Asset.find({ assignedTo: new RegExp(`^${me.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean(),
    ChecklistItem.find({ type: CHECKLIST_TYPE.ONBOARDING, employee: me.name }).sort({ createdAt: 1 }).lean(),
  ]);

  res.render("profile/index", {
    linked: true,
    profile: me,
    assets,
    onboardingTasks,
  });
}

module.exports = { showMyProfile };
