const User = require("../models/User");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Location = require("../models/Location");
const Asset = require("../models/Asset");
const { icon, initials } = require("../utils/icons");
const { isAdminTeam } = require("../utils/teamAccess");
const { csvUiMeta } = require("../utils/csvMeta");
const { resolveCsvImportAccess } = require("../utils/csvAccess");
const { unreadCount } = require("../utils/notifications");
const { getAssignableUsers } = require("../utils/userDirectory");

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

// Same idea, for the three other "pick from what already exists" lists
// that show up across many unrelated modules (an employee's name, a
// company location, a piece of equipment) — a shared cached name list
// beats every controller re-solving the same lookup its own way, which
// is how half of them ended up with no suggestion list at all.
let employeeCache = { names: [], expiresAt: 0 };
async function getEmployeeNames() {
  if (Date.now() < employeeCache.expiresAt) return employeeCache.names;
  const rows = await Employee.find().sort({ name: 1 }).select("name").lean();
  employeeCache = { names: rows.map((e) => e.name), expiresAt: Date.now() + 60000 };
  return employeeCache.names;
}

let locationCache = { names: [], expiresAt: 0 };
async function getLocationNames() {
  if (Date.now() < locationCache.expiresAt) return locationCache.names;
  const rows = await Location.find().sort({ name: 1 }).select("name").lean();
  locationCache = { names: rows.map((l) => l.name), expiresAt: Date.now() + 60000 };
  return locationCache.names;
}

let assetNameCache = { names: [], expiresAt: 0 };
async function getAssetNames() {
  if (Date.now() < assetNameCache.expiresAt) return assetNameCache.names;
  const rows = await Asset.find({ status: { $ne: "Decommissioned" } })
    .sort({ assetName: 1 })
    .select("assetId assetName")
    .lean();
  assetNameCache = { names: rows.map((a) => `${a.assetName} (${a.assetId})`), expiresAt: Date.now() + 60000 };
  return assetNameCache.names;
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
    // Shared "is this an Admin-team member" flag — header.ejs computes
    // its own copy of this same check inline (for the nav dropdown), but
    // partials/csvActions.ejs needs it too and, unlike header.ejs, isn't
    // always the thing that's included first on a page, so it gets a
    // real global instead of relying on include-order.
    res.locals.isAdminTeamUser = req.user ? isAdminTeam(req.user) : false;
    // Lightweight (no model refs) per-module CSV export/import metadata —
    // see utils/csvMeta.js / utils/csvRegistry.js — so partials/csvActions.ejs
    // can render the Export link for a given moduleKey without every
    // controller having to pass it in.
    res.locals.csvModuleMeta = csvUiMeta;
    // Whether the current user may IMPORT into each CSV-registered
    // module — resolved once here (permission checks are async; EJS
    // can't await mid-render) via utils/csvAccess.js, the exact same
    // logic csvController.js itself enforces at request time. Cheap:
    // hasPermission() caches the whole Permission map in-process.
    res.locals.csvCanImport = await resolveCsvImportAccess(req.user);
    // Shared inline-SVG icon helper (src/utils/icons.js) — available on
    // every page, signed in or not, so header.ejs/login.ejs/etc. can call
    // `<%- icon('home') %>` instead of hardcoding emoji or markup per view.
    res.locals.icon = icon;
    // Same idea for the two-letter avatar-initials helper — used for the
    // audit-trail timeline and any table that shows a person's name.
    res.locals.initials = initials;
    // Bare path (no query string) so header.ejs's top tab bar can
    // highlight whichever department tab the current page belongs to
    // (e.g. "/operations/..." keeps the Operations tab lit) without
    // every single controller having to pass it in explicitly.
    res.locals.currentPath = req.path || req.originalUrl.split("?")[0];
    // The raw query object for the current request, so
    // partials/pagination.ejs can build Prev/Next links that keep
    // every other active filter/search param intact — no controller
    // has to pass this in separately, same trick as currentPath above.
    res.locals.currentQuery = req.query || {};
    // Same "don't make every controller pass this in" trick, for the
    // Department datalist every "Department" field in the app now uses.
    res.locals.departmentList = req.user ? await getDepartmentNames() : [];
    // Same trick again for Employee/Location/Asset name suggestions —
    // see header.ejs for the <datalist> markup these feed.
    res.locals.employeeList = req.user ? await getEmployeeNames() : [];
    res.locals.locationList = req.user ? await getLocationNames() : [];
    res.locals.assetNameList = req.user ? await getAssetNames() : [];
    // Task #102 — real User accounts for the engineer/assignee suggestion
    // list (see utils/userDirectory.js), same cached/global pattern as
    // the lists above. A separate list from employeeList on purpose: an
    // assignee is someone who logs into THIS app and works tickets, not
    // just anyone in the HR employee directory.
    res.locals.assignableUsers = req.user ? await getAssignableUsers() : [];
    // Unread in-app notification count for the bell icon (partials/header.ejs)
    // — cheap (one indexed count query) and only run for signed-in users.
    res.locals.unreadNotifications = req.user ? await unreadCount(req.user._id) : 0;
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
