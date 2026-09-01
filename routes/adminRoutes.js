const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

// Mirrors requirePermission() from Security.gs — same pattern used by every
// other module's routes file (see incidentRoutes.js).
function guard(action) {
  return async (req, res, next) => {
    const allowed = await hasPermission(req.user.role, action);
    if (!allowed) {
      return res.status(403).render("errors/403", { action });
    }
    next();
  };
}

router.use(requireLogin);

router.get("/", guard("admin_view_database"), adminController.showSummary);

router.get("/users", guard("admin_manage_users"), adminController.listUsers);
router.get("/users/new", guard("admin_manage_users"), adminController.showNewUserForm);
router.post("/users", guard("admin_manage_users"), adminController.createUser);
router.get("/users/:id/edit", guard("admin_manage_users"), adminController.showEditUserForm);
router.post("/users/:id", guard("admin_manage_users"), adminController.updateUser);

router.get("/permissions", guard("admin_manage_settings"), adminController.showPermissionMatrix);
router.post("/permissions", guard("admin_manage_settings"), adminController.updatePermissionMatrix);

module.exports = router;
