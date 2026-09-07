/*************************************************************
 * notificationController.js — the /notifications list page
 * behind the header bell icon. Reuses src/utils/notifications.js's
 * listForUser/markAllRead/markOneRead — this controller is just the
 * thin page/route layer on top.
 *************************************************************/
const { listForUser, markAllRead, markOneRead } = require("../utils/notifications");

async function listNotifications(req, res) {
  const notifications = await listForUser(req.user._id, 50);
  res.render("notifications/index", { notifications });
}

async function markAllReadAction(req, res) {
  await markAllRead(req.user._id);
  res.redirect("/notifications");
}

async function markOneReadAction(req, res) {
  await markOneRead(req.user._id, req.params.id);
  const backTo = req.body.link || "/notifications";
  res.redirect(backTo);
}

module.exports = { listNotifications, markAllReadAction, markOneReadAction };
