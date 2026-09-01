/*************************************************************
 * profileController.js — port of ProfileEngine.gs. Self-service hub
 * pulling together everything about the LOGGED-IN user: their
 * directory record, assigned assets, and onboarding checklist
 * progress (if they're a new hire). Nothing is stored here — it's
 * purely an aggregator over other collections, same as the original.
 *
 * Leave balances are wired up as of Phase 4B (see utils/leaveBalances.js).
 * My Trainings is wired up as of Phase 4D (LMS) — pulls this employee's
 * enrollments + earned certificates, same as the original's
 * getMyTrainingsSafe()/getMyCertificatesSafe().
 *************************************************************/
const Employee = require("../models/Employee");
const Asset = require("../models/Asset");
const ChecklistItem = require("../models/Checklist");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { getAllLeaveBalances } = require("../utils/leaveBalances");
const Enrollment = require("../models/Enrollment");
const Certificate = require("../models/Certificate");

async function showMyProfile(req, res) {
  const me = await Employee.findOne({ email: req.user.email.toLowerCase().trim() }).lean();

  if (!me) {
    return res.render("profile/index", {
      linked: false,
      profile: null,
      assets: [],
      onboardingTasks: [],
      leaveBalances: null,
      myTrainings: [],
      myCertificates: [],
    });
  }

  const [assets, onboardingTasks, leaveBalances, myTrainings, myCertificates] = await Promise.all([
    Asset.find({ assignedTo: new RegExp(`^${me.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean(),
    ChecklistItem.find({ type: CHECKLIST_TYPE.ONBOARDING, employee: me.name }).sort({ createdAt: 1 }).lean(),
    getAllLeaveBalances(me.name),
    Enrollment.find({ employee: me.name }).sort({ enrollmentDate: -1 }).lean(),
    Certificate.find({ employee: me.name }).sort({ issuedDate: -1 }).lean(),
  ]);

  res.render("profile/index", {
    linked: true,
    profile: me,
    assets,
    onboardingTasks,
    leaveBalances,
    myTrainings,
    myCertificates,
  });
}

module.exports = { showMyProfile };
