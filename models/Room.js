const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Conference Rooms" sheet (RoomBookingEngine.gs):
 * Room ID | Room Name | Location | Capacity | Status. Auto-seeded with
 * the company's real conference rooms on first boot (see server.js's
 * autoSeed(), same idempotent pattern as Permissions/SLA Matrix), so
 * there's something to book immediately instead of an empty list —
 * same reasoning as the original's seedDefaultConferenceRooms().
 */
const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true, index: true }, // ROOM-YYYY-000001

    roomName: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    capacity: { type: Number },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
