const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { requireLogin } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", expenseController.listExpenses);
router.get("/mine", expenseController.myExpenses);
router.get("/new", guard("expenses_submit"), expenseController.showNewForm);
router.post("/", guard("expenses_submit"), expenseController.submitClaim);
router.post("/:id/decision", guard("expenses_approve"), expenseController.decideClaim);
router.post("/:id/reimburse", guard("expenses_approve"), expenseController.markReimbursed);

module.exports = router;
