const express = require("express");
const router = express.Router();
const ecrController = require("../controllers/ecrController");
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

router.get("/", ecrController.listECRs);
router.get("/new", guard("ecr_create"), ecrController.showNewForm);
router.post("/", guard("ecr_create"), ecrController.createECR);
router.post("/:id/decision", guard("ecr_decide"), ecrController.decideECR);

module.exports = router;
