const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/authController");

// Basic brute-force guard on the login form only — 10 attempts per IP
// every 15 minutes. Doesn't touch any other route, so normal browsing
// (including a slow free-tier cold start) is never affected.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many sign-in attempts from this network. Please wait a few minutes and try again.",
});

router.get("/login", authController.showLogin);
router.post("/login", loginLimiter, authController.login);
router.post("/logout", authController.logout);

module.exports = router;
