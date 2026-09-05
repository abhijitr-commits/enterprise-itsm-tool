const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/auth");
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Change = require("../models/Change");
const LeaveRequest = require("../models/LeaveRequest");
const { STATUS } = require("../config/constants");
const { APPROVAL } = require("../models/ServiceRequest");

router.get("/", requireLogin, async (req, res) => {
  const [open, inProgress, onHold, resolved, breached, closedToday, pendingRequests, pendingChanges, pendingLeave] = await Promise.all([
    Incident.countDocuments({ status: STATUS.OPEN }),
    Incident.countDocuments({ status: STATUS.IN_PROGRESS }),
    Incident.countDocuments({ status: STATUS.ON_HOLD }),
    Incident.countDocuments({ status: STATUS.RESOLVED }),
    Incident.countDocuments({ status: { $ne: STATUS.CLOSED }, slaDue: { $lt: new Date() } }),
    Incident.countDocuments({
      status: STATUS.CLOSED,
      closedDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    ServiceRequest.countDocuments({ approvalStatus: APPROVAL.PENDING }),
    Change.countDocuments({ cabStatus: APPROVAL.PENDING }),
    LeaveRequest.countDocuments({ status: APPROVAL.PENDING }),
  ]);

  const recent = await Incident.find().sort({ createdDate: -1 }).limit(8).lean();

  // 14-day incident volume trend for the Dashboard's area chart — grouped
  // by calendar day so the chart reads as "new incidents per day" rather
  // than a running total.
  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - 13);
  trendStart.setHours(0, 0, 0, 0);
  const trendRaw = await Incident.aggregate([
    { $match: { createdDate: { $gte: trendStart } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdDate" } }, count: { $sum: 1 } } },
  ]);
  const trendMap = {};
  trendRaw.forEach((r) => { trendMap[r._id] = r.count; });
  const trend = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ date: key, count: trendMap[key] || 0 });
  }

  res.render("dashboard", {
    open,
    inProgress,
    onHold,
    resolved,
    breached,
    closedToday,
    pendingApprovals: pendingRequests + pendingChanges + pendingLeave,
    recent,
    trend,
  });
});

module.exports = router;
