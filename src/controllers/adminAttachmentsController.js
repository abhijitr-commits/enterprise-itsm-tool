/*************************************************************
 * adminAttachmentsController.js — attachment support for the 7
 * Admin-team modules built this session, none of which have an
 * individual record detail page (they're all list + inline-action,
 * same pattern as Purchase Orders). Rather than build 7 bespoke detail
 * pages just to host an upload/download panel, this is ONE small
 * generic "record attachments" page reused by all 7 — the same
 * approach as the CSV export/import engine (utils/csvRegistry.js):
 * one implementation, a small per-module config table.
 *
 * Reuses utils/recordExtras.js's getAttachmentsForRecord() and
 * partials/attachments.ejs exactly as every core-ITSM detail page
 * does; upload/download themselves still go through the existing
 * generic attachmentRoutes.js / attachmentController.js — this
 * controller only renders the page that hosts that partial and
 * resolves a human-readable record label to show at the top.
 *************************************************************/
const { getAttachmentsForRecord } = require("../utils/recordExtras");
const { isAdminTeam } = require("../utils/teamAccess");
const AdminAsset = require("../models/AdminAsset");
const AdminPurchase = require("../models/AdminPurchase");
const AdminScrapItem = require("../models/AdminScrapItem");
const AdminStockItem = require("../models/AdminStockItem");
const AdminVendor = require("../models/AdminVendor");
const AdminComplaint = require("../models/AdminComplaint");
const AdminFacilityTask = require("../models/AdminFacilityTask");

// moduleKey here matches attachmentController.js's MODULE_CONFIG keys
// exactly ("admin-assets", not the CSV engine's "adminAsset") — the
// two engines were built independently and key their modules
// differently; this table is the one place that has to know both.
const RECORD_CONFIG = {
  "admin-assets": { model: AdminAsset, idField: "assetId", labelField: "assetName", listPath: "/admin/assets", listLabel: "Asset Register" },
  "admin-purchases": { model: AdminPurchase, idField: "poId", labelField: "itemDescription", listPath: "/admin/purchases", listLabel: "Purchase/Procurement" },
  "admin-scrap": { model: AdminScrapItem, idField: "scrapId", labelField: "itemName", listPath: "/admin/scrap", listLabel: "Scrap Management" },
  "admin-stock": { model: AdminStockItem, idField: "itemId", labelField: "itemName", listPath: "/admin/stock", listLabel: "Stock Management" },
  "admin-vendors": { model: AdminVendor, idField: null, labelField: "name", listPath: "/admin/vendors", listLabel: "Vendor Management" },
  "admin-helpdesk": { model: AdminComplaint, idField: "complaintId", labelField: "subject", listPath: "/admin/helpdesk", listLabel: "Facility Helpdesk" },
  "admin-facility": { model: AdminFacilityTask, idField: "taskId", labelField: "taskName", listPath: "/admin/facility-tasks", listLabel: "Facility Ops Tasks" },
};

async function showAttachments(req, res) {
  const { moduleKey, recordId } = req.params;
  const config = RECORD_CONFIG[moduleKey];
  if (!config) return res.status(404).render("errors/404");

  const record = await config.model.findById(recordId).lean();
  if (!record) return res.status(404).render("errors/404");

  const [attachments] = await Promise.all([getAttachmentsForRecord(moduleKey, recordId)]);
  const recordLabel = `${config.idField && record[config.idField] ? record[config.idField] + " — " : ""}${record[config.labelField] || ""}`;

  res.render("admin-shared/attachments", {
    moduleKey,
    recordId,
    recordLabel,
    listPath: config.listPath,
    listLabel: config.listLabel,
    attachments,
    canUpload: isAdminTeam(req.user),
    message: req.query.message || null,
    error: req.query.error || null,
  });
}

module.exports = { showAttachments, RECORD_CONFIG };
