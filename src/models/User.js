const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLE } = require("../config/constants");

// Per-ACCOUNT lockout, separate from and in addition to authRoutes.js's
// per-IP rate limiter (10 attempts/15min from one network). This one
// protects a single account from a distributed/slow-drip guessing
// attempt, or from many people sharing one office IP tripping the other
// limiter's shared bucket for everyone.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ROLE),
      default: ROLE.VIEWER,
    },
    department: { type: String, trim: true }, // plain text, matching every other module's department field
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plainPassword) {
  this.passwordHash = await bcrypt.hash(plainPassword, 10);
};

userSchema.methods.checkPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.isLocked = function () {
  return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
};

// Called on every failed password check for a real, active user. Once
// LOCKOUT_THRESHOLD consecutive failures pile up, the account locks for
// LOCKOUT_MINUTES — a genuinely wrong password from here on resets
// nothing further (the clock doesn't restart on every retry) but a
// SUCCESSFUL login clears the counter, so an occasional typo by the
// account's real owner never accumulates toward a lockout over time.
userSchema.methods.registerFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= LOCKOUT_THRESHOLD && !this.isLocked()) {
    this.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
  }
  await this.save();
};

userSchema.methods.registerSuccessfulLogin = async function () {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.lastLoginAt = new Date();
  await this.save();
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    active: this.active,
  };
};

module.exports = mongoose.model("User", userSchema);
module.exports.LOCKOUT_MINUTES = LOCKOUT_MINUTES;
