const express = require("express");
const router = express.Router();
const shiftController = require("../controllers/shiftController");
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

router.get("/", shiftController.showShiftsAndRoster);
router.post("/", guard("shifts_manage"), shiftController.createShift);
router.post("/roster", guard("shifts_manage"), shiftController.assignShift);

module.exports = router;
