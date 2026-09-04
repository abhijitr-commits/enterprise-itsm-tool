const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
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

router.get("/", vendorController.listVendors);
router.get("/new", guard("vendors_create"), vendorController.showNewForm);
router.post("/", guard("vendors_create"), vendorController.createVendor);
router.get("/:id/edit", guard("vendors_edit"), vendorController.showEditForm);
router.post("/:id", guard("vendors_edit"), vendorController.updateVendor);

module.exports = router;
