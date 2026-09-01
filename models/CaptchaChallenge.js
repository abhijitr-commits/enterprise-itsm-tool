const mongoose = require("mongoose");

/**
 * Backs the public incident form's math CAPTCHA — port of Navigation.gs's
 * doGet()/IncidentEngine.gs's createPublicIncident() caching the correct
 * answer server-side under a one-time token (CacheService in the
 * original), so a bot can't just submit a hardcoded "answer". A Mongo
 * TTL index stands in for CacheService's 10-minute expiry, since this
 * app has no in-memory cache that reliably survives between requests on
 * Render's free tier (the process can restart between page-load and
 * form-submit).
 *
 * Deleted immediately once correctly answered (see
 * publicIntakeController.js) — one-time use, same as the original.
 */
const captchaChallengeSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  num1: { type: Number, required: true },
  num2: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // 10 minutes, same window as the original
});

module.exports = mongoose.model("CaptchaChallenge", captchaChallengeSchema);
