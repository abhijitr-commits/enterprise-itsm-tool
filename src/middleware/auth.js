const User = require("../models/User");
const Department = require("../models/Department");

// Short in-memory cache for the Department master list (Admin Console ->
// Master Data -> Departments), so every "Department" field across the
// app can offer a <datalist> of real names — see partials/header.ejs —
// without a fresh DB query on every single page view. 60s is plenty:
// the list only changes when an Admin edits Master Data, and a stale
// name for under a minute is harmless (it's a suggestion, not a hard
// constraint — the field still accepts free text either way).
let departmentCache = { names: [], expiresAt: 0 };
async function getDepartmentNames() {
  if (Date.now() < departmentCache.expiresAt) return departmentCache.names;
  const rows = await Department.find().sort({ name: 1 }).select("name").lean();
  departmentCache = { names: rows.map((d) => d.name), expiresAt: Date.now() + 60000 };
  return departmentCache.names;
}

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
    // Same "don't make every controller pass this in" trick, for the
    // Department datalist every "Department" field in the app now uses.
    res.locals.departmentList = req.user ? await getDepartmentNames() : [];
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
