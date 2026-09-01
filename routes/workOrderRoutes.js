const express = require("express");
const router = express.Router();
const workOrderController = require("../controllers/workOrderController");
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

router.get("/", workOrderController.listWorkOrders);
router.get("/new", guard("workorders_create"), workOrderController.showNewForm);
router.post("/", guard("workorders_create"), workOrderController.createWorkOrder);
router.post("/:id/status", guard("workorders_edit"), workOrderController.updateWorkOrder);

module.exports = router;
