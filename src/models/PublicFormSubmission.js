const mongoose = require("mongoose");

/**
 * A bare timestamp log used only to enforce the public incident form's
 * rate limit — port of createPublicIncident()'s crude 20-submissions-
 * per-10-minute global throttle ("Apps Script has no reliable way to
 * see a visitor's IP address for proper per-IP throttling", same
 * limitation here, so this stays a global counter, not per-IP). One
 * document per accepted submission; the 10-minute TTL index does the
 * decay for us instead of the original's CacheService counter + window.
 */
const publicFormSubmissionSchema = new mongoose.Schema({
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

module.exports = mongoose.model("PublicFormSubmission", publicFormSubmissionSchema);
