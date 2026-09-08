const User = require("../models/User");
const { logAudit } = require("../utils/auditLog");

function showLogin(req, res) {
  if (req.user) return res.redirect("/");
  res.render("login", { error: null });
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });

  // Locked accounts are rejected before even checking the password, so a
  // legitimate owner who mistypes once more while locked doesn't also
  // reset/extend anything — the lock has its own fixed expiry.
  if (user && user.isLocked()) {
    const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
    return res.render("login", {
      error: `Too many failed sign-in attempts. This account is locked for ${minutesLeft} more minute${minutesLeft === 1 ? "" : "s"} — contact your Administrator if you need in sooner.`,
    });
  }

  if (!user || !user.active || !(await user.checkPassword(password))) {
    // Only a real, active user's own failed attempts count toward their
    // lockout — an unknown email or a deactivated account never trips it.
    if (user && user.active) await user.registerFailedLogin();
    return res.render("login", { error: "Invalid email or password." });
  }

  await user.registerSuccessfulLogin();

  // Regenerate the session ID on every successful login rather than reusing
  // whatever session ID the browser walked in with — otherwise a session ID
  // an attacker set on the victim's browser BEFORE they logged in (a
  // "session fixation" attack) would become a valid authenticated session
  // the moment they sign in.
  req.session.regenerate((err) => {
    if (err) {
      console.error("[auth] session regenerate failed:", err);
      return res.render("login", { error: "Something went wrong signing you in. Please try again." });
    }

    req.session.userId = user._id.toString();

    logAudit({
      user: user._id,
      action: "Login",
      entityType: "User",
      entityId: user._id,
      ipAddress: req.ip,
    }).catch((auditErr) => console.error("[auth] logAudit failed after login (non-fatal):", auditErr));

    res.redirect("/");
  });
}

function logout(req, res) {
  req.session.destroy(() => res.redirect("/login"));
}

module.exports = { showLogin, login, logout };
