const User = require("../models/User");

/** Loads the logged-in user (from session) onto req.user for every request. */
async function attachUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.active) {
        req.user = user;
      }
    }
    res.locals.currentUser = req.user || null;
    // Bare path (no query string) so header.ejs's top tab bar can
    // highlight whichever department tab the current page belongs to
    // (e.g. "/operations/..." keeps the Operations tab lit) without
    // every single controller having to pass it in explicitly.
    res.locals.currentPath = req.path || req.originalUrl.split("?")[0];
    next();
  } catch (err) {
    next(err);
  }
}

/** Redirects to /login for page routes that require a signed-in user. */
function requireLogin(req, res, next) {
  if (!req.user) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({ success: false, message: "Please sign in." });
    }
    return res.redirect("/login");
  }
  next();
}

module.exports = { attachUser, requireLogin };
