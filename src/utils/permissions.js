/*************************************************************
 * permissions.js (utils) — port of hasPermission()/requirePermission()
 * from Security.gs. Reads the Mongo-backed Permission collection
 * (seeded from config/permissions.js) instead of the sheet-backed
 * map, with the same 60-second-style caching behavior collapsed
 * into a short in-process cache.
 *************************************************************/
const Permission = require("../models/Permission");

let permCache = { map: null, expiresAt: 0 };

async function getPermissionsMap() {
  const now = Date.now();
  if (permCache.map && now < permCache.expiresAt) {
    return permCache.map;
  }

  const rows = await Permission.find().lean();
  const map = {};
  rows.forEach((r) => {
    map[r.action] = r.allowedRoles;
  });

  permCache = { map, expiresAt: now + 60 * 1000 }; // 60s, same as original
  return map;
}

async function hasPermission(role, action) {
  const map = await getPermissionsMap();
  const allowed = map[action];

  if (!allowed) {
    console.warn(`[permissions] Unknown permission key requested: ${action}`);
    return false;
  }

  return allowed.includes(role);
}

/**
 * Express middleware factory — use as requirePermission("incidents_create")
 * in a route chain. Assumes req.user has already been attached (see
 * middleware/auth.js) and responds 403 with the same style of message
 * the original threw as an Error the client's failure handler displayed.
 */
function requirePermission(action) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Please sign in." });
      }

      const allowed = await hasPermission(req.user.role, action);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: `You don't have permission to do this (${action}).`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Port of CacheService.getScriptCache().remove("PERMISSIONS_MAP") from the
 * original togglePermission(). Call this right after writing a Permission
 * document so the change is visible on the very next request instead of
 * waiting out the 60-second cache window.
 */
function clearPermissionsCache() {
  permCache = { map: null, expiresAt: 0 };
}

module.exports = { hasPermission, requirePermission, getPermissionsMap, clearPermissionsCache };
