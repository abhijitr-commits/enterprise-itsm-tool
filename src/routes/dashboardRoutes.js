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

  res.render("dashboard", {
    open,
    inProgress,
    onHold,
    resolved,
    breached,
    closedToday,
    pendingApprovals: pendingRequests + pendingChanges + pendingLeave,
    recent,
  });
});

module.exports = router;
