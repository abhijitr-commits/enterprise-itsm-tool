const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Maintenance Announcements" sheet
 * (MaintenanceEngine.gs): Announcement ID | Title | Description |
 * Site/Location | Scheduled Start | Scheduled End | Created By |
 * Created Date.
 */
const maintenanceAnnouncementSchema = new mongoose.Schema(
  {
    announcementId: { type: String, unique: true, index: true }, // MAINT-YYYY-000001

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    site: { type: String, trim: true, default: "All" },
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

module.exports = mongoose.model("MaintenanceAnnouncement", maintenanceAnnouncementSchema);
