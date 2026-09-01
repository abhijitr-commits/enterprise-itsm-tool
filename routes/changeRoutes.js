const express = require("express");
const router = express.Router();
const changeController = require("../controllers/changeController");
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

router.get("/", changeController.listChanges);
router.get("/new", guard("changes_create"), changeController.showNewForm);
router.post("/", guard("changes_create"), changeController.createChange);
router.post("/bulk-decide", guard("changes_approve"), changeController.bulkDecideChanges);
router.get("/:id", changeController.showChange);
router.post("/:id", guard("changes_edit"), changeController.updateChange);
router.post("/:id/decide", guard("changes_approve"), changeController.decideChange);
router.post("/:id/implementation-status", guard("changes_edit"), changeController.updateImplementationStatus);
router.post("/:id/close", guard("changes_close"), changeController.closeChangeWithPIR);
router.post("/:id/comments", changeController.addComment);

module.exports = router;
