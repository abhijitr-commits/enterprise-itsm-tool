/*************************************************************
 * apiAuth.js — Architecture Phase 4 (see itsm_architecture_comparison.md):
 * token-based auth for the Integration API (/api/v1/*), the piece every
 * commercial ITSM platform exposes so other systems (a monitoring tool,
 * a website contact form, a CI pipeline) can file or read tickets without
 * a human logging in through the browser.
 *
 * Reuses the exact same generic Setting store (utils/settings.js) already
 * used for the Slack/Teams webhook URLs — one more key, "ApiAccessToken",
 * no new collection, no new third-party account, no cost. An
 * Administrator generates the key from Admin -> Integrations; nothing is
 * enabled until they do, so this adds zero attack surface out of the box.
 *************************************************************/
const crypto = require("crypto");
const { getSetting, setSetting } = require("./settings");

const SETTING_KEY = "ApiAccessToken";

/** Raw token as currently configured, or "" if the API has never been enabled. */
async function getApiToken() {
  return getSetting(SETTING_KEY, "");
}

/** Generates a brand-new random token and stores it, replacing any previous one. */
async function generateApiToken() {
  const token = crypto.randomBytes(24).toString("hex");
  await setSetting(SETTING_KEY, token);
  return token;
}

/** Disables the API entirely (every request will 503 until a new key is generated). */
async function revokeApiToken() {
  await setSetting(SETTING_KEY, "");
}

/**
 * Express middleware factory — gates every /api/v1/* route on a valid
 * `X-Api-Key` header, compared with a constant-time check so response
 * timing can't be used to guess the key one byte at a time.
 */
function requireApiToken() {
  return async (req, res, next) => {
    try {
      const configured = await getApiToken();
      if (!configured) {
        return res.status(503).json({
          success: false,
          message: "The Integration API is not enabled yet. An Administrator can turn it on at Admin Console -> Integrations.",
        });
      }

      const supplied = req.get("X-Api-Key") || "";
      const a = Buffer.from(String(supplied));
      const b = Buffer.from(String(configured));
      const match = a.length === b.length && crypto.timingSafeEqual(a, b);

      if (!match) {
        return res.status(401).json({ success: false, message: "Invalid or missing X-Api-Key header." });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { getApiToken, generateApiToken, revokeApiToken, requireApiToken };
