const express = require("express");
const router = express.Router();
const shipmentController = require("../controllers/shipmentController");
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

router.get("/", shipmentController.listShipments);
router.get("/new", guard("shipments_create"), shipmentController.showNewForm);
router.post("/", guard("shipments_create"), shipmentController.createShipment);
router.post("/:id/status", guard("shipments_edit"), shipmentController.updateStatus);

module.exports = router;
