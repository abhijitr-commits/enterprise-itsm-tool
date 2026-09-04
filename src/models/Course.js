const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Training Catalog" sheet (LMSEngine.gs):
 * Course ID | Title | Type | Category | Duration (Hours) | Provider |
 * Description | Link/Location | Status. Does not host actual course
 * content — this is a catalog + enrollment tracker, same as the original.
 */
const COURSE_TYPE = { ONLINE: "Online", OFFLINE: "Offline" };
const COURSE_STATUS = { ACTIVE: "Active", INACTIVE: "Inactive" };

const courseSchema = new mongoose.Schema(
  {
    courseId: { type: String, unique: true, index: true }, // CRS-YYYY-000001
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(COURSE_TYPE), required: true },
    category: { type: String, trim: true, default: "General" },
    durationHours: { type: Number },
    provider: { type: String, trim: true },
    description: { type: String, trim: true },
    linkOrLocation: { type: String, trim: true },
    status: { type: String, enum: Object.values(COURSE_STATUS), default: COURSE_STATUS.ACTIVE },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
module.exports.COURSE_TYPE = COURSE_TYPE;
module.exports.COURSE_STATUS = COURSE_STATUS;
