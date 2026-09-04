const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Conference Room Bookings" sheet
 * (RoomBookingEngine.gs): Booking ID | Room ID | Room Name | Date |
 * Start Time | End Time | Booked By | Purpose | Status | Created Date.
 *
 * date/startTime/endTime are stored as plain strings (YYYY-MM-DD /
 * HH:MM), matching the original's own string comparisons for the
 * conflict check (roomBookingController.js) rather than Date objects.
 */
const roomBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, index: true }, // BOOK-YYYY-000001

    roomId: { type: String, required: true, trim: true },
    roomName: { type: String, trim: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true }, // HH:MM
    bookedBy: { type: String, trim: true },
    purpose: { type: String, trim: true },
    status: { type: String, enum: ["Confirmed", "Cancelled"], default: "Confirmed" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

module.exports = mongoose.model("RoomBooking", roomBookingSchema);
