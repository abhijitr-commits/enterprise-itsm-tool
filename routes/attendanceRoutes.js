const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const { hasPermission } = require("../utils/permissions");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

router.get("/", attendanceController.showMyAttendance);
router.post("/checkin", attendanceController.checkIn);
router.post("/checkout", attendanceController.checkOut);

router.get("/all", async (req, res, next) => {
  const allowed = await hasPermission(req.user.role, "reports_view");
  if (!allowed) return res.status(403).render("errors/403", { action: "reports_view" });
  next();
}, attendanceController.showAllAttendance);

module.exports = router;
