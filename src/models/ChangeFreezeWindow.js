const mongoose = require("mongoose");

/*************************************************************
 * ChangeFreezeWindow — audit backlog item "Change Management
 * maturity: freeze windows, calendar view, conflict detection."
 *
 * A freeze window is an Admin-declared date range (month-end close,
 * a holiday period, a major product launch weekend, ...) during
 * which routine changes should not be scheduled. It's deliberately
 * a tiny standalone collection rather than a new field bolted onto
 * Change, for two reasons: (1) it's managed by Admin/CAB ahead of
 * time, independent of any single change record, and (2) it slots
 * straight into the existing generic Master Data CRUD screen (see
 * masterDataController.js) with zero new view code needed.
 *
 * Read by two places: changeController's createChange/updateChange
 * (blocks a non-High-risk change from being planned inside an active
 * window — see utils/changeFreeze.js) and the new /changes/calendar
 * view (shades the affected days so CAB can see freeze coverage and
 * same-day change conflicts at a glance).
 *************************************************************/
const changeFreezeWindowSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, trim: true },
  },
  { timestamps: true }
);

changeFreezeWindowSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model("ChangeFreezeWindow", changeFreezeWindowSchema);
