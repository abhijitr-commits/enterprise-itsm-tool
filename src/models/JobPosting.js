const mongoose = require("mongoose");

/** Field-for-field port of the "Job Postings" sheet (ATSEngine.gs): Job ID | Title | Department | Status | Posted Date | Description. */
const JOB_STATUS = { OPEN: "Open", CLOSED: "Closed" };

const jobPostingSchema = new mongoose.Schema(
  {
    jobId: { type: String, unique: true, index: true }, // JOB-YYYY-000001
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(JOB_STATUS), default: JOB_STATUS.OPEN },
    description: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "postedDate", updatedAt: true } }
);

module.exports = mongoose.model("JobPosting", jobPostingSchema);
module.exports.JOB_STATUS = JOB_STATUS;
