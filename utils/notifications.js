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

module.exports = { sendSlackNotification, sendTeamsNotification, notifyChannels };
