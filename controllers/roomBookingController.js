/*************************************************************
 * roomBookingController.js — port of RoomBookingEngine.gs.
 * Conference room booking with automatic conflict detection — you
 * can't double-book a room for an overlapping time slot. The default
 * room list is auto-seeded on boot (server.js's autoSeed()), same
 * idempotent pattern as Permissions/SLA Matrix.
 *************************************************************/
const Room = require("../models/Room");
const RoomBooking = require("../models/RoomBooking");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { isHRTeam } = require("../utils/teamAccess");
const { hasPermission } = require("../utils/permissions");

async function listRooms(req, res) {
  const rooms = await Room.find({ status: "Active" }).sort({ roomName: 1 }).lean();
  res.render("rooms/list", { rooms, message: req.query.message || null });
}

async function createRoom(req, res) {
  try {
    const data = req.body;
    if (!data.roomName) throw new Error("Room Name is required.");

    const roomId = await generateSequentialId("ROOM");
    await Room.create({ roomId, roomName: data.roomName, location: data.location || "", capacity: data.capacity || undefined });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Room", details: data.roomName });

    res.redirect(`/rooms?message=${encodeURIComponent("Conference Room Added Successfully")}`);
  } catch (err) {
    res.redirect(`/rooms?message=${encodeURIComponent(err.message)}`);
  }
}

async function listBookings(req, res) {
  const [rooms, bookings, canManageRooms] = await Promise.all([
    Room.find({ status: "Active" }).sort({ roomName: 1 }).lean(),
    RoomBooking.find().sort({ date: -1, startTime: -1 }).lean(),
    hasPermission(req.user.role, "rooms_manage"),
  ]);

  res.render("rooms/bookings", {
    rooms,
    bookings,
    currentUserName: req.user.name,
    canCancelAny: isHRTeam(req.user),
    canManageRooms,
    message: req.query.message || null,
  });
}

async function showNewBookingForm(req, res) {
  const rooms = await Room.find({ status: "Active" }).sort({ roomName: 1 }).lean();
  res.render("rooms/new-booking", { error: null, form: {}, rooms });
}

/**
 * Port of createBooking() — CONFLICT CHECK: no overlapping bookings
 * for the same room/date, same comparison as the original
 * (startTime < existing.endTime && endTime > existing.startTime).
 */
async function createBooking(req, res) {
  try {
    const data = req.body;
    if (!data.roomId) throw new Error("Room is required.");
    if (!data.date) throw new Error("Date is required.");
    if (!data.startTime) throw new Error("Start Time is required.");
    if (!data.endTime) throw new Error("End Time is required.");
    if (data.endTime <= data.startTime) throw new Error("End Time must be after Start Time.");

    const room = await Room.findOne({ roomId: data.roomId, status: "Active" }).lean();
    if (!room) throw new Error("Room not found.");

    const existingBookings = await RoomBooking.find({ roomId: data.roomId, date: data.date, status: { $ne: "Cancelled" } }).lean();
    const hasConflict = existingBookings.some((b) => data.startTime < b.endTime && data.endTime > b.startTime);

    if (hasConflict) {
      throw new Error(`${room.roomName} is already booked for an overlapping time on ${data.date}. Choose a different time or room.`);
    }

    const bookingId = await generateSequentialId("BOOK");
    await RoomBooking.create({
      bookingId,
      roomId: room.roomId,
      roomName: room.roomName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      bookedBy: req.user.name,
      purpose: data.purpose || "",
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Room Booking", details: `${room.roomName} on ${data.date}` });

    // Original also emailed a confirmation to the booker — no email
    // provider yet (see MIGRATION.md), the confirmation is the booking
    // itself now showing in the list.
    res.redirect(`/rooms/bookings?message=${encodeURIComponent("Conference Room Booked Successfully.")}`);
  } catch (err) {
    res.redirect(`/rooms/bookings?message=${encodeURIComponent(err.message)}`);
  }
}

/** Port of cancelBooking() — only the person who booked it (or HR team) can cancel. */
async function cancelBooking(req, res) {
  try {
    const booking = await RoomBooking.findById(req.params.id);
    if (!booking) return res.status(404).render("errors/404");

    if (booking.bookedBy.trim().toLowerCase() !== req.user.name.trim().toLowerCase() && !isHRTeam(req.user)) {
      throw new Error("Only the person who booked this room (or an Admin) can cancel it.");
    }

    booking.status = "Cancelled";
    await booking.save();

    await logAudit({ user: req.user._id, action: "Cancel", entityType: "Room Booking", entityId: booking._id });

    res.redirect(`/rooms/bookings?message=${encodeURIComponent("Booking Cancelled.")}`);
  } catch (err) {
    res.redirect(`/rooms/bookings?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { listRooms, createRoom, listBookings, showNewBookingForm, createBooking, cancelBooking };
