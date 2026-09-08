/*************************************************************
 * csrf.js — a minimal synchronizer-token CSRF guard.
 *
 * Every state-changing route in this app is a plain HTML
 * `<form method="post">` (no fetch/XHR, no custom header) submitted
 * on a cookie-based session — with nothing checking for this today,
 * any page anywhere on the web could silently submit a hidden form
 * to this app using a signed-in visitor's own session (approve an
 * access request, change a ticket's status, etc.) just by getting
 * them to open a malicious page while logged in here.
 *
 * Scope, deliberately narrower than "every POST":
 *   - Only applied to SIGNED-IN requests (checked via req.user, set
 *     by middleware/auth.js's attachUser, which must run before this
 *     in server.js). The app's two unauthenticated POST flows are
 *     intentionally left out:
 *       - /support (the public incident form) already has its own
 *         defenses suited to an anonymous form — honeypot + math
 *         CAPTCHA + a rolling rate limit, see
 *         publicIntakeController.js. Issuing a CSRF token would mean
 *         creating a session (hence a MongoDB session document via
 *         connect-mongo) for every anonymous visitor just to hand
 *         them a token — exactly the kind of unbounded, bot-driven
 *         storage growth this free-tier-only project has otherwise
 *         been careful to avoid (see PublicFormSubmission.js's own
 *         TTL-index comment).
 *       - /login's own CSRF exposure ("login CSRF" — tricking a
 *         victim into authenticating into an attacker's account) is
 *         real but far lower-severity than authenticated-action
 *         CSRF, and protecting it hits the same anonymous-session
 *         cost problem above.
 *   - The Integration API (/api/v1/*) is excluded — those routes
 *     authenticate via a bearer API key (see utils/apiAuth.js), not a
 *     browser session cookie, so classic CSRF (some OTHER site
 *     silently using the victim's cookies) doesn't apply, and a JSON
 *     API client has no HTML form to carry a hidden _csrf field in.
 *
 * The token itself is injected into every rendered `<form method=
 * "post">` client-side (see views/partials/header.ejs's meta tag +
 * partials/footer.ejs's injection script) rather than by hand-editing
 * every one of this app's ~115 view files with forms.
 *************************************************************/
const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Runs after attachUser. Issues (or reuses) a per-session token for any signed-in request, exposed to every view as res.locals.csrfToken. */
function attachCsrfToken(req, res, next) {
  if (req.user) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
}

/** Runs after attachCsrfToken. Rejects a state-changing request from a signed-in user whose _csrf field doesn't match their session's token. */
function verifyCsrfToken(req, res, next) {
  if (!req.user) return next(); // anonymous flows are out of scope, see file header
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.originalUrl.startsWith("/api/")) return next(); // API-key auth, not cookie/session-based

  const submitted = req.body && req.body._csrf;
  if (submitted && req.session.csrfToken && submitted === req.session.csrfToken) {
    return next();
  }

  console.warn(`[csrf] Rejected ${req.method} ${req.originalUrl} from user ${req.user.email || req.user._id} — missing/stale CSRF token.`);
  res
    .status(403)
    .send(
      '<!doctype html><html><head><meta charset="utf-8"><title>Please try again</title><link rel="stylesheet" href="/css/style.css"></head>' +
        '<body class="centered-page"><div class="login-card" style="text-align:center">' +
        "<h1>Please try again</h1>" +
        '<p class="subtitle">This page had been open a while, so we could not confirm your last action came from it. Nothing was changed — please go back and try again.</p>' +
        '<a class="btn btn-primary" href="/">Back to Dashboard</a>' +
        "</div></body></html>"
    );
}

module.exports = { attachCsrfToken, verifyCsrfToken };
