const mongoose = require("mongoose");

/**
 * In-app notification bell (task tracked as "#73" during the ITSM rollout).
 * Deliberately tiny: one recipient (a real User account, never a free-text
 * name), a short message, an optional link to the record it's about, and a
 * read flag. Nothing here sends email or pushes anything externally — see
 * src/utils/notifications.js's notifyUser() for how rows land here, and
 * the (separately blocked, pending an SMTP app password) email flow this
 * is intentionally NOT coupled to.
 */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Powers both the bell's unread badge (user + read) and the /notifications
// list page (user, newest first) with a single compound index.
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
