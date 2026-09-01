const User = require("../models/User");
const { logAudit } = require("../utils/auditLog");

function showLogin(req, res) {
  if (req.user) return res.redirect("/");
  res.render("login", { error: null });
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });

  if (!user || !user.active || !(await user.checkPassword(password))) {
    return res.render("login", { error: "Invalid email or password." });
  }

  req.session.userId = user._id.toString();
  user.lastLoginAt = new Date();
  await user.save();

  await logAudit({
    user: user._id,
    action: "Login",
    entityType: "User",
    entityId: user._id,
    ipAddress: req.ip,
  });

  res.redirect("/");
}

function logout(req, res) {
  req.session.destroy(() => res.redirect("/login"));
}

module.exports = { showLogin, login, logout };
