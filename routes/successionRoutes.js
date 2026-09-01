const express = require("express");
const router = express.Router();
const successionController = require("../controllers/successionController");
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
// Every route here is gated to "succession_manage" (Admin/Manager) — no
// employee self-service at all, unlike Goals/Reviews. See
// successionController.js's header for the permission-key bug fix.
router.use(guard("succession_manage"));

router.get("/", successionController.listPlans);
router.get("/new", successionController.showNewForm);
router.post("/", successionController.createPlan);
router.get("/:id/edit", successionController.showEditForm);
router.post("/:id", successionController.updatePlan);

module.exports = router;
