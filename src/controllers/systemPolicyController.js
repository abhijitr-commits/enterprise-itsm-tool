/*************************************************************
 * systemPolicyController.js — port of NotificationChannelEngine.gs's
 * getSystemPoliciesSafe()/saveSystemPolicy() as they apply to the
 * genuinely HR-owned business rules the original split out of its
 * general Admin settings: Annual (Casual) Leave Quota, Medical/Sick
 * Leave Quota, Unpaid Leave Quota (a policy reference, not a hard
 * block — see leaveBalances.js), and the Standard Notice Period.
 * requireHRTeam(), same as the original — this is HR's call, not
 * general system administration (which is why it's a separate
 * module from Admin Console's Integration Settings, Phase 5E's
 * admin_manage_settings-gated page).
 *
 * Reuses the exact same generic Setting store (utils/settings.js)
 * Phase 4E built for Letter Templates and Phase 5E reused for
 * Slack/Teams webhooks — same "getSetting(key, fallback)" idea,
 * just four more keys: AnnualLeaveQuota / MedicalLeaveQuota /
 * UnpaidLeaveQuota / NoticePeriodDays, matching the original's own
 * key names exactly so nothing has to be renamed.
 *
 * NoticePeriodDays is stored but not read anywhere else in this
 * app — same as the original, where it's a policy reference value
 * only (grep of the original source turns up no getSetting() call
 * for it outside this settings form itself); it's carried over for
 * completeness, not because something downstream depends on it.
 *
 * The form's own footnote (carried over verbatim, see the view)
 * says an over-quota Unpaid Leave request "is flagged for the
 * approver" — that's the original's own UI copy, but no such flag
 * exists anywhere in `LeaveEngine.gs`, and none is added here
 * either; the quota is purely informational (the balance display),
 * same lack of enforcement as every other leave type. Noted here
 * rather than silently dropped or silently "fixed," since it's the
 * original's own claim, not something this port introduced.
 *************************************************************/
const { getSetting, setSetting } = require("../utils/settings");
const { logAudit } = require("../utils/auditLog");
const { LEAVE_QUOTAS } = require("../config/constants");

const POLICY_KEYS = ["AnnualLeaveQuota", "MedicalLeaveQuota", "UnpaidLeaveQuota", "NoticePeriodDays"];

async function showPolicies(req, res) {
  const [annualLeaveQuota, medicalLeaveQuota, unpaidLeaveQuota, noticePeriodDays] = await Promise.all([
    getSetting("AnnualLeaveQuota", String(LEAVE_QUOTAS.CASUAL)),
    getSetting("MedicalLeaveQuota", String(LEAVE_QUOTAS.SICK)),
    getSetting("UnpaidLeaveQuota", String(LEAVE_QUOTAS.UNPAID)),
    getSetting("NoticePeriodDays", "30"),
  ]);

  res.render("system-policies/index", {
    annualLeaveQuota,
    medicalLeaveQuota,
    unpaidLeaveQuota,
    noticePeriodDays,
    message: req.query.message || null,
    error: null,
  });
}

async function savePolicies(req, res) {
  try {
    const values = {};
    for (const key of POLICY_KEYS) {
      const raw = req.body[key];
      const num = Number(raw);
      if (!raw || !Number.isFinite(num) || num <= 0) {
        throw new Error(`${key} must be a positive number.`);
      }
      values[key] = String(Math.round(num));
    }

    await Promise.all(POLICY_KEYS.map((key) => setSetting(key, values[key])));

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Setting",
      details: `System Policies updated: ${POLICY_KEYS.map((k) => `${k}=${values[k]}`).join(", ")}.`,
    });

    res.redirect("/system-policies?message=" + encodeURIComponent("Policies saved."));
  } catch (err) {
    const [annualLeaveQuota, medicalLeaveQuota, unpaidLeaveQuota, noticePeriodDays] = await Promise.all([
      getSetting("AnnualLeaveQuota", String(LEAVE_QUOTAS.CASUAL)),
      getSetting("MedicalLeaveQuota", String(LEAVE_QUOTAS.SICK)),
      getSetting("UnpaidLeaveQuota", String(LEAVE_QUOTAS.UNPAID)),
      getSetting("NoticePeriodDays", "30"),
    ]);

    res.status(400).render("system-policies/index", {
      annualLeaveQuota: req.body.AnnualLeaveQuota || annualLeaveQuota,
      medicalLeaveQuota: req.body.MedicalLeaveQuota || medicalLeaveQuota,
      unpaidLeaveQuota: req.body.UnpaidLeaveQuota || unpaidLeaveQuota,
      noticePeriodDays: req.body.NoticePeriodDays || noticePeriodDays,
      message: null,
      error: err.message,
    });
  }
}

module.exports = { showPolicies, savePolicies };
