/*************************************************************
 * attendanceController.js — port of AttendanceEngine.gs. A simple
 * honor-system log (people click a button), not biometric/geofenced
 * tracking — same caveat as the original. The identity check is the
 * important part carried over exactly: you can only check YOURSELF
 * in/out (employee name comes from req.user.name, the authenticated
 * session — never from user input), never anyone else.
 *************************************************************/
const Attendance = require("../models/Attendance");
const { hasPermission } = require("../utils/permissions");

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function showMyAttendance(req, res) {
  const records = await Attendance.find({ employee: req.user.name }).sort({ date: -1 }).lean();
  const canViewAll = await hasPermission(req.user.role, "reports_view");

  const today = todayKey();
  const todayRecord = records.find((r) => r.date === today);

  res.render("attendance/my", {
    records,
    todayRecord: todayRecord || null,
    canViewAll,
    message: req.query.message || null,
    error: req.query.error || null,
  });
}

async function checkIn(req, res) {
  const today = todayKey();
  const existing = await Attendance.findOne({ employee: req.user.name, date: today });

  if (existing) {
    return res.redirect("/attendance?error=" + encodeURIComponent("Already checked in today."));
  }

  await Attendance.create({ date: today, employee: req.user.name, checkIn: new Date() });
  res.redirect("/attendance?message=" + encodeURIComponent(`Checked in successfully as ${req.user.name}.`));
}

async function checkOut(req, res) {
  const today = todayKey();
  const record = await Attendance.findOne({ employee: req.user.name, date: today, checkOut: null });

  if (!record) {
    return res.redirect("/attendance?error=" + encodeURIComponent("No open check-in found for today."));
  }

  const checkOutTime = new Date();
  const hours = Number(((checkOutTime.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2));

  record.checkOut = checkOutTime;
  record.hours = hours;
  await record.save();

  res.redirect("/attendance?message=" + encodeURIComponent(`Checked out successfully. Hours: ${hours}`));
}

async function showAllAttendance(req, res) {
  const records = await Attendance.find().sort({ date: -1 }).lean();
  res.render("attendance/all", { records });
}

module.exports = { showMyAttendance, checkIn, checkOut, showAllAttendance };
