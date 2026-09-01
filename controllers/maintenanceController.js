/*************************************************************
 * maintenanceController.js — port of MaintenanceEngine.gs.
 *
 * Scheduled maintenance announcements — reading the list is open to
 * anyone signed in (matches the original — getAllMaintenanceAnnouncementsSafe()
 * has no permission check); creating is IT-team gated, matching
 * requireITTeam().
 *
 * Deferred vs. the original: broadcasting an email + in-app
 * notification to everyone at the announced site (or the whole
 * company) — no email provider yet (see MIGRATION.md). The
 * announcement is still recorded and shown to everyone on the list
 * page, same "record instead of emailing" substitution used
 * throughout this migration.
 *************************************************************/
const MaintenanceAnnouncement = require("../models/MaintenanceAnnouncement");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listAnnouncements(req, res) {
  const announcements = await MaintenanceAnnouncement.find().sort({ createdDate: -1 }).lean();
  res.render("maintenance/list", { announcements, message: req.query.message || null });
}

function showNewForm(req, res) {
  res.render("maintenance/new", { error: null, form: {} });
}

async function createAnnouncement(req, res) {
  try {
    const data = req.body;
    if (!data.title) throw new Error("Title is required.");
    if (!data.description) throw new Error("Description is required.");

    const announcementId = await generateSequentialId("MAINT");
    await MaintenanceAnnouncement.create({
      announcementId,
      title: data.title,
      description: data.description,
      site: data.site || "All",
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
      createdBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Maintenance",
      details: `${data.title} (${data.site || "All"})`,
    });

    res.redirect(`/maintenance?message=${encodeURIComponent("Maintenance announcement recorded and posted.")}`);
  } catch (err) {
    res.status(400).render("maintenance/new", { error: err.message, form: req.body });
  }
}

module.exports = { listAnnouncements, showNewForm, createAnnouncement };
