const express = require("express");
const router = express.Router();
const roomBookingController = require("../controllers/roomBookingController");
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

router.get("/", roomBookingController.listRooms);
router.post("/", guard("rooms_manage"), roomBookingController.createRoom);
router.get("/bookings", roomBookingController.listBookings);
router.get("/bookings/new", guard("rooms_book"), roomBookingController.showNewBookingForm);
router.post("/bookings", guard("rooms_book"), roomBookingController.createBooking);
router.post("/bookings/:id/cancel", roomBookingController.cancelBooking);

module.exports = router;
