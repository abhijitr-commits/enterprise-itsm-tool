/*************************************************************
 * expenseController.js — port of ExpenseEngine.gs.
 *
 * Reading the full list is open to any signed-in user (matches the
 * original — getAllExpenseClaimsSafe() has no permission check
 * there either), same "canApprove" flag pattern Leave/Requests use;
 * submitting is "expenses_submit" (every role, by default) and
 * deciding/reimbursing is "expenses_approve" (Admin/Manager by
 * default) via the Permission Matrix.
 *
 * Deferred vs. the original: routing a notification to the
 * employee's actual manager/department head by email — no email
 * provider yet (see MIGRATION.md), recorded in the audit log instead.
 *************************************************************/
const ExpenseClaim = require("../models/ExpenseClaim");
const { EXPENSE_STATUS } = ExpenseClaim;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");

async function listExpenses(req, res) {
  const claims = await ExpenseClaim.find().sort({ submittedDate: -1 }).lean();
  const canApprove = await hasPermission(req.user.role, "expenses_approve");

  res.render("expenses/list", { claims, canApprove, EXPENSE_STATUS, message: req.query.message || null });
}

async function myExpenses(req, res) {
  const claims = await ExpenseClaim.find({ employee: req.user.name }).sort({ submittedDate: -1 }).lean();
  res.render("expenses/mine", { claims, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("expenses/new", { error: null, form: {} });
}

async function submitClaim(req, res) {
  try {
    const data = req.body;
    if (!data.category) throw new Error("Category is required.");
    if (!data.amount || Number(data.amount) <= 0) throw new Error("Amount must be greater than 0.");

    const claimId = await generateSequentialId("EXP");
    await ExpenseClaim.create({
      claimId,
      employee: req.user.name,
      department: req.user.department || "",
      category: data.category,
      amount: data.amount,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      description: data.description || "",
      receiptUrl: data.receiptUrl || "",
    });

    await logAudit({
      user: req.user._id,
      action: "Submit",
      entityType: "Expense",
      details: `${req.user.name} — ${data.category} (${data.amount})`,
    });

    res.redirect("/expenses/mine?message=Expense Claim Submitted Successfully");
  } catch (err) {
    res.status(400).render("expenses/new", { error: err.message, form: req.body });
  }
}

async function decideClaim(req, res) {
  try {
    const { decision } = req.body;
    if (![EXPENSE_STATUS.APPROVED, EXPENSE_STATUS.REJECTED].includes(decision)) throw new Error("Invalid decision.");

    const claim = await ExpenseClaim.findById(req.params.id);
    if (!claim) return res.status(404).render("errors/404");

    claim.status = decision;
    claim.approver = req.user.email;
    await claim.save();

    await logAudit({ user: req.user._id, action: "Decision", entityType: "Expense", entityId: claim._id, details: decision });

    res.redirect(`/expenses?message=${encodeURIComponent(`Expense Claim ${decision}.`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function markReimbursed(req, res) {
  try {
    const claim = await ExpenseClaim.findById(req.params.id);
    if (!claim) return res.status(404).render("errors/404");
    if (claim.status !== EXPENSE_STATUS.APPROVED) throw new Error("Only approved claims can be marked reimbursed.");

    claim.status = EXPENSE_STATUS.REIMBURSED;
    await claim.save();

    await logAudit({ user: req.user._id, action: "Reimbursed", entityType: "Expense", entityId: claim._id });

    res.redirect(`/expenses?message=${encodeURIComponent("Marked as Reimbursed.")}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listExpenses, myExpenses, showNewForm, submitClaim, decideClaim, markReimbursed };
