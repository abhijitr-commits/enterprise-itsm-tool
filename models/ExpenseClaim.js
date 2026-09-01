const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Expense Claims" sheet (ExpenseEngine.gs):
 * Claim ID | Employee | Department | Category | Amount | Expense Date
 * | Description | Receipt URL | Status | Approver | Submitted Date.
 * Same Department Head routing pattern as Service Requests/Changes/
 * Leave in spirit — see expenseController.js for how approval is
 * actually gated here (Permission Matrix, not a specific manager).
 */
const EXPENSE_STATUS = {
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REIMBURSED: "Reimbursed",
};

const expenseClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, unique: true, index: true }, // EXP-YYYY-000001

    employee: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    expenseDate: { type: Date },
    description: { type: String, trim: true },
    receiptUrl: { type: String, trim: true },
    status: { type: String, enum: Object.values(EXPENSE_STATUS), default: EXPENSE_STATUS.PENDING_APPROVAL },
    approver: { type: String, trim: true },
  },
  { timestamps: { createdAt: "submittedDate", updatedAt: false } }
);

module.exports = mongoose.model("ExpenseClaim", expenseClaimSchema);
module.exports.EXPENSE_STATUS = EXPENSE_STATUS;
