const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Conference Rooms" sheet (RoomBookingEngine.gs):
 * Room ID | Room Name | Location | Capacity | Status. Auto-seeded with
 * the company's real conference rooms on first boot (see server.js's
 * autoSeed(), same idempotent pattern as Permissions/SLA Matrix), so
 * there's something to book immediately instead of an empty list —
 * same reasoning as the original's seedDefaultConferenceRooms().
 *
 * Phase 9 addition: `resourceType` lets this same booking system also
 * cover shared lab/robotics equipment (a test rig, a dev robot unit, a
 * bench) — not just meeting rooms. Reuses the exact same model,
 * conflict-check logic, and views as Conference Rooms rather than
 * building a parallel "Equipment Booking" module from scratch; a
 * robotics company's most-contested shared resource is often a test
 * bench, not a meeting room, and the underlying problem (don't
 * double-book a shared, schedulable thing) is identical either way.
 */
const RESOURCE_TYPE = { ROOM: "Room", EQUIPMENT: "Equipment" };

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true, index: true }, // ROOM-YYYY-000001

    roomName: { type: String, required: true, trim: true },
    resourceType: { type: String, enum: Object.values(RESOURCE_TYPE), default: RESOURCE_TYPE.ROOM },
    location: { type: String, trim: true },
    capacity: { type: Number },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
module.exports.RESOURCE_TYPE = RESOURCE_TYPE;
