/*************************************************************
 * policyController.js — port of PolicyAcknowledgmentEngine.gs.
 * Tracks which employees have formally acknowledged which IT
 * policies (Acceptable Use, Data Security, BYOD, etc.) — IT team
 * defines policies, every employee acknowledges them, and there's a
 * clear compliance record of who has and hasn't.
 *
 * Reading the (active) policy list is open to any signed-in user,
 * matching the original's getAllPoliciesSafe() (no permission
 * check — it's also used internally to compute what's still
 * pending for an employee). Creating a policy and viewing the
 * compliance report are both IT-team gated (requireITTeam), same
 * as the original's createPolicy()/getPolicyComplianceSafe().
 * Acknowledging is self-service for any employee with a linked
 * Employee record, same ownership guarantee as everywhere else
 * (Goals, Reviews) — you can only acknowledge as yourself.
 *
 * Deferred vs. the original: notifying every active user by email
 * when a new policy is published — no email provider yet (see
 * MIGRATION.md); the policy simply appears in everyone's "pending
 * acknowledgment" list on My Profile instead.
 *************************************************************/
const Policy = require("../models/Policy");
const PolicyAcknowledgment = require("../models/PolicyAcknowledgment");
const Employee = require("../models/Employee");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listPolicies(req, res) {
  const policies = await Policy.find({ active: true }).sort({ createdDate: -1 }).lean();

  const me = await Employee.findOne({ email: req.user.email.toLowerCase().trim() }).lean();
  let ackedPolicyIds = [];
  if (me) {
    const acks = await PolicyAcknowledgment.find({ employee: me.name }).lean();
    ackedPolicyIds = acks.map((a) => a.policyId);
  }

  res.render("policies/list", { policies, ackedPolicyIds, linked: !!me, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("policies/new", { error: null, form: {} });
}

async function createPolicy(req, res) {
  try {
    const data = req.body;
    if (!data.policyName) throw new Error("Policy Name is required.");
    if (!data.content) throw new Error("Policy content is required.");

    const policyId = await generateSequentialId("POL");
    const policy = await Policy.create({
      policyId,
      policyName: data.policyName,
      version: data.version || "1.0",
      content: data.content,
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Policy", entityId: policy._id, details: data.policyName });

    res.redirect("/policies?message=Policy Created Successfully");
  } catch (err) {
    res.status(400).render("policies/new", { error: err.message, form: req.body });
  }
}

async function acknowledgePolicy(req, res) {
  try {
    const policy = await Policy.findOne({ policyId: req.params.policyId }).lean();
    if (!policy) return res.status(404).render("errors/404");

    const me = await Employee.findOne({ email: req.user.email.toLowerCase().trim() }).lean();
    if (!me) throw new Error("Your account isn't linked to an employee record yet.");

    const already = await PolicyAcknowledgment.exists({ policyId: policy.policyId, employee: me.name });
    if (!already) {
      const ackId = await generateSequentialId("ACK");
      await PolicyAcknowledgment.create({ ackId, policyId: policy.policyId, policyName: policy.policyName, employee: me.name });

      await logAudit({ user: req.user._id, action: "Acknowledged", entityType: "Policy", entityId: policy._id, details: me.name });
    }

    res.redirect("/policies?message=Policy acknowledged. Thank you.");
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function showCompliance(req, res) {
  const policy = await Policy.findOne({ policyId: req.params.policyId }).lean();
  if (!policy) return res.status(404).render("errors/404");

  const employees = await Employee.find({ status: { $ne: "Left" } }).lean();
  const acks = await PolicyAcknowledgment.find({ policyId: policy.policyId }).lean();
  const ackedNames = new Set(acks.map((a) => a.employee.trim().toLowerCase()));

  const rows = employees.map((e) => ({
    name: e.name,
    department: e.department,
    acknowledged: ackedNames.has(e.name.trim().toLowerCase()),
  }));

  res.render("policies/compliance", { policy, rows });
}

module.exports = { listPolicies, showNewForm, createPolicy, acknowledgePolicy, showCompliance };
