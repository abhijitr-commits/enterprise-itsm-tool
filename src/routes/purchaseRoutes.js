const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
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

router.get("/", guard("purchases_create"), purchaseController.listPurchases);
router.post("/", guard("purchases_create"), purchaseController.createPurchase);
router.post("/:id/status", guard("purchases_edit"), purchaseController.updateStatus);

module.exports = router;
