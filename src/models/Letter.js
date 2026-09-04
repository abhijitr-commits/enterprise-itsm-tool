const mongoose = require("mongoose");

/**
 * NOT in the original — a new small record type this port needs that
 * the original didn't. LetterEngine.gs never persisted a generated
 * letter anywhere: it merged the template and immediately emailed the
 * result (MailApp.sendEmail), so the email inbox WAS the record. This
 * app has no email provider yet (see MIGRATION.md), so every merged
 * letter is saved here instead — same "audit-log/record instead of
 * emailing" substitution used everywhere else in this migration, just
 * with a full persisted copy instead of just an audit-log line, since
 * a letter (unlike a plain notification) is something HR and the
 * recipient genuinely need to come back to and print. Rendered as a
 * printable page (views/letters/view.ejs), same pattern as the
 * training Certificate.
 */
const LETTER_TYPE = {
  OFFER: "Offer Letter",
  APPOINTMENT: "Appointment Letter",
  NO_DUES: "No Dues Certificate",
  RELIEVING: "Relieving Letter",
};

const letterSchema = new mongoose.Schema(
  {
    letterId: { type: String, unique: true, index: true }, // LTR-YYYY-000001
    type: { type: String, enum: Object.values(LETTER_TYPE), required: true },
    recipientName: { type: String, required: true, trim: true },
    recipientEmail: { type: String, trim: true, lowercase: true },
    content: { type: String, required: true },
    relatedId: { type: String, trim: true }, // candidateId / resignationId / employeeId, informational only
    generatedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "generatedDate", updatedAt: false } }
);

letterSchema.index({ recipientName: 1 });

module.exports = mongoose.model("Letter", letterSchema);
module.exports.LETTER_TYPE = LETTER_TYPE;
