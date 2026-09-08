/*************************************************************
 * notifications.js — port of NotificationChannelEngine.gs's
 * sendSlackNotification()/sendTeamsNotification()/
 * sendChannelNotifications(). Sends to Slack and/or Microsoft
 * Teams via Incoming Webhooks, reading the webhook URLs from
 * the existing generic Setting store (utils/settings.js) —
 * same "SlackWebhookURL"/"TeamsWebhookURL" keys as the original,
 * just backed by Mongo instead of the Settings sheet.
 *
 * Nothing is hardcoded and no new third-party account is ever
 * created by this app: an Admin pastes in webhook URLs they
 * generate themselves (see views/admin/integrations.ejs for the
 * setup instructions, carried over from the original's file
 * header comment), for channels their company already has.
 * Leaving either URL blank skips that channel entirely — same
 * "fails silently, breaks nothing" behavior as the original.
 *************************************************************/
const { getSetting } = require("./settings");
const Notification = require("../models/Notification");
const User = require("../models/User");

async function sendSlackNotification(subject, body) {
  const webhookUrl = await getSetting("SlackWebhookURL", "");
  if (!webhookUrl) return { sent: false, reason: "No Slack webhook URL configured." };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${subject}*\n${body}` }),
    });
    if (!res.ok) {
      return { sent: false, reason: `Slack webhook returned HTTP ${res.status}.` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Slack notification failed: ${err.message}` };
  }
}

async function sendTeamsNotification(subject, body) {
  const webhookUrl = await getSetting("TeamsWebhookURL", "");
  if (!webhookUrl) return { sent: false, reason: "No Teams webhook URL configured." };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        summary: subject,
        title: subject,
        text: body,
      }),
    });
    if (!res.ok) {
      return { sent: false, reason: `Teams webhook returned HTTP ${res.status}.` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Teams notification failed: ${err.message}` };
  }
}

/**
 * Fire both channels at once — port of sendChannelNotifications().
 * Used by the manual "Send Expiry Digest Now" action (the pragmatic,
 * zero-new-accounts substitute for AutomationEngine.gs's daily
 * sendExpiryAlerts() trigger — see MIGRATION.md Phase 5E) and
 * available from the Integration Settings page's "Send Test
 * Notification" button.
 */
async function notifyChannels(subject, body) {
  const [slack, teams] = await Promise.all([sendSlackNotification(subject, body), sendTeamsNotification(subject, body)]);
  return { slack, teams };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Best-effort recipient lookup, in order of reliability:
 *   1. userId — an actual User reference, when the caller has one.
 *   2. email — resolves via the field the migration DID keep reliable
 *      (createdBy-style fields store the filer's real email address).
 *   3. name — several other fields are a spreadsheet-migration leftover:
 *      free-text display names rather than User references (e.g.
 *      Incident.engineer, ServiceRequest.requester — see MIGRATION.md).
 *      An exact, case-insensitive match against User.name is the best we
 *      can do without a real reference. If it's ambiguous (two users
 *      share a name) or nobody matches, this silently returns null —
 *      better to skip a notification than send it to the wrong person.
 * Never throws: a lookup failure just means no recipient was found.
 */
async function resolveRecipient({ userId, email, name }) {
  try {
    if (userId) {
      const u = await User.findById(userId).select("_id active");
      if (u && u.active) return u._id;
    }
    if (email) {
      const u = await User.findOne({ email: String(email).toLowerCase().trim(), active: true }).select("_id");
      if (u) return u._id;
    }
    if (name && String(name).trim()) {
      const rx = new RegExp(`^${escapeRegex(String(name).trim())}$`, "i");
      const matches = await User.find({ name: rx, active: true }).select("_id").limit(2);
      if (matches.length === 1) return matches[0]._id;
    }
  } catch (err) {
    console.error("[notifications] resolveRecipient failed (non-fatal):", err.message);
  }
  return null;
}

/**
 * Creates one in-app notification (see models/Notification.js and the
 * bell icon in partials/header.ejs). This is a courtesy, not a dependency:
 * every call site should fire it without awaiting the result (same
 * pattern as serviceRequestController.js's recordCatalogUsage) so a
 * notification-write hiccup can never delay or fail the action it's
 * attached to. Resolves to the created Notification, or null if no
 * recipient could be found or the write failed.
 */
async function notifyUser({ userId, email, name, message, link = "" }) {
  try {
    const recipientId = await resolveRecipient({ userId, email, name });
    if (!recipientId) return null;
    return await Notification.create({ user: recipientId, message, link });
  } catch (err) {
    console.error("[notifications] notifyUser failed (non-fatal):", err.message);
    return null;
  }
}

/** Unread count for the bell badge — see middleware/auth.js's attachUser. */
async function unreadCount(userId) {
  if (!userId) return 0;
  try {
    return await Notification.countDocuments({ user: userId, read: false });
  } catch (err) {
    console.error("[notifications] unreadCount failed (non-fatal):", err.message);
    return 0;
  }
}

/** Most-recent notifications for the /notifications list page. */
async function listForUser(userId, limit = 30) {
  if (!userId) return [];
  try {
    return await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
  } catch (err) {
    console.error("[notifications] listForUser failed (non-fatal):", err.message);
    return [];
  }
}

async function markAllRead(userId) {
  if (!userId) return;
  await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
}

async function markOneRead(userId, notificationId) {
  if (!userId || !notificationId) return;
  await Notification.updateOne({ _id: notificationId, user: userId }, { $set: { read: true } });
}

module.exports = {
  sendSlackNotification,
  sendTeamsNotification,
  notifyChannels,
  notifyUser,
  unreadCount,
  listForUser,
  markAllRead,
  markOneRead,
  // Exported for utils/userDirectory.js (task #102) — the exact same
  // "does this typed name match exactly one real account" resolution
  // notifyUser has always used internally, now reused to populate the
  // engineer/assignee *Ref fields instead of duplicating the lookup.
  resolveRecipient,
};
