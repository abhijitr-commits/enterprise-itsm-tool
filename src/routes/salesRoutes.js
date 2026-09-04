const express = require("express");
const router = express.Router();
const salesController = require("../controllers/salesController");
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

router.get("/", salesController.listSalesOrders);
router.get("/new", guard("sales_create"), salesController.showNewForm);
router.post("/", guard("sales_create"), salesController.createSalesOrder);
router.post("/:id/status", guard("sales_edit"), salesController.updateStatus);

module.exports = router;
