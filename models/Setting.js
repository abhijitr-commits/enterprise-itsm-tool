const mongoose = require("mongoose");

/**
 * Generic key/value settings store — port of Config.gs's
 * getSetting()/setSettingInternal(), which read/wrote Apps Script's
 * Script Properties. There's no equivalent built-in key/value store
 * in this app, so it's one small Mongo collection instead. First
 * (and so far only) user: the Letter Templates editor
 * (LetterEngine.gs), which lets HR customize the Offer Letter /
 * Appointment Letter / No Dues Certificate wording without a code
 * change.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
