const express = require("express");
const router = express.Router();
const masterDataController = require("../controllers/masterDataController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

// Master Data (Departments/Locations/Categories/SLA Matrix) is
// configuration, not a day-to-day ticket module — gated the same way as
// the rest of the Admin Console, via admin_manage_settings.
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
router.use(guard("admin_manage_settings"));

router.get("/:table", masterDataController.listRows);
router.get("/:table/new", masterDataController.showNewForm);
router.post("/:table", masterDataController.createRow);
router.get("/:table/:id/edit", masterDataController.showEditForm);
router.post("/:table/:id", masterDataController.updateRow);
router.post("/:table/:id/delete", masterDataController.deleteRow);

module.exports = router;
