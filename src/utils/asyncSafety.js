/*************************************************************
 * asyncSafety.js — installs a crash-safety net for this app.
 *
 * Express 4 does NOT automatically catch a rejected Promise thrown
 * inside an async route handler or middleware function — an
 * unhandled rejection there crashes the entire Node process (killing
 * every concurrent user's session, not just the one failing
 * request). With ~60 controllers and 18 route files, most handlers
 * are plain `async function (req, res) {...}` with no try/catch, so
 * something as simple as a typo'd/stale-bookmark id in a URL
 * (`/incidents/not-an-id` — Mongoose throws a CastError on that)
 * would take the whole app down until Render auto-restarts it.
 *
 * This patches Express's route-registration methods (get/post/put/
 * patch/delete/all) on both `express.application` (the top-level
 * app) and `express.Router` (every router created via
 * express.Router(), i.e. every routes/*.js file) so that ANY
 * handler/middleware passed to them — a controller function,
 * requireLogin, the shared per-route guard(action) permission check,
 * etc. — automatically forwards a thrown error or rejected Promise
 * to next(err), which server.js's existing 4-arg error-handling
 * middleware already turns into a clean 500 page instead of a crash.
 * Verified against this app's actual express@4.19.2: a sync throw,
 * an async rejection, and an invalid-ObjectId CastError inside a
 * router handler all now reach the error handler instead of
 * bringing down the process.
 *
 * Deliberately does NOT patch `.use()` — that method is reserved in
 * this app for mounting sub-routers (`app.use("/incidents",
 * incidentRoutes)`) and global middleware (helmet, morgan, session),
 * not leaf request handlers. Leaving it untouched avoids any risk of
 * interfering with how Express mounts/dispatches nested routers, and
 * every actual controller/guard function in this app is registered
 * via router.get/post/put/patch/delete, which this DOES cover.
 *
 * MUST be required before any route file — every routes/*.js file
 * calls express.Router() and registers its routes at require() time,
 * so the patch has to already be in place on the shared prototype
 * before that happens. See the very top of server.js.
 *************************************************************/
const express = require("express");

const ROUTE_METHODS = ["get", "post", "put", "patch", "delete", "all"];

function wrapHandler(handler) {
  // Express identifies error-handling middleware by exactly 4 declared
  // params — (err, req, res, next). Never touch those; wrapping would
  // hide that arity from Express's own dispatch logic and break it.
  if (typeof handler !== "function" || handler.length === 4) return handler;

  return function wrapped(...args) {
    const next = args[args.length - 1];
    try {
      const result = handler.apply(this, args);
      if (result && typeof result.catch === "function") {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

function patch(proto) {
  ROUTE_METHODS.forEach((method) => {
    const original = proto[method];
    if (typeof original !== "function") return;
    proto[method] = function (...args) {
      return original.apply(this, args.map(wrapHandler));
    };
  });
}

patch(express.application);
patch(express.Router);

module.exports = {}; // side-effect-only module
