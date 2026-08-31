const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/auth");
const Incident = require("../models/Incident");
const { STATUS } = require("../config/constants");

router.get("/", requireLogin, async (req, res) => {
  const [open, inProgress, breached, closedToday] = await Promise.all([
    Incident.countDocuments({ status: STATUS.OPEN }),
    Incident.countDocuments({ status: STATUS.IN_PROGRESS }),
    Incident.countDocuments({ status: { $ne: STATUS.CLOSED }, slaDue: { $lt: new Date() } }),
    Incident.countDocuments({
      status: STATUS.CLOSED,
      closedDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  const recent = await Incident.find().sort({ createdDate: -1 }).limit(8).lean();

  res.render("dashboard", { open, inProgress, breached, closedToday, recent });
});

module.exports = router;
