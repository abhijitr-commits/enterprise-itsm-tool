const express = require("express");
const router = express.Router();
const problemController = require("../controllers/problemController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) return res.status(403).render("errors/403", { action });
    next();
  };
}

router.use(requireLogin);

router.get("/", problemController.listProblems);
router.get("/new", guard("problems_create"), problemController.showNewForm);
router.post("/", guard("problems_create"), problemController.createProblem);
router.get("/:id", problemController.showProblem);
router.post("/:id", guard("problems_edit"), problemController.updateProblem);
router.post("/:id/close", guard("problems_close"), problemController.closeProblem);
router.post("/:id/comments", problemController.addComment);

module.exports = router;
