/*************************************************************
 * attachmentController.js — port of AttachmentEngine.gs's
 * uploadAttachment(module, recordId, fileName, mimeType, base64Data).
 * One generic upload/download pair shared by all six attachment-
 * eligible modules (Incidents, Service Requests, Problems, Changes,
 * Assets, CMDB) — same multer-memoryStorage pattern as
 * employeeDocumentController.js, see models/Attachment.js for why
 * files live in MongoDB instead of Drive.
 *************************************************************/
const multer = require("multer");
const mongoose = require("mongoose");
const Attachment = require("../models/Attachment");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB — same shared-Atlas-tier reason as EmployeeDocument

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } }).single("file");

// Route-prefix module key -> { label matching the entityType strings
// already used across every controller's logAudit() calls, the
// permission action that gates uploading, and where "back" points. }
const MODULE_CONFIG = {
  incidents: { label: "Incident", editAction: "incidents_edit", base: "/incidents" },
  requests: { label: "Service Request", editAction: "requests_edit", base: "/requests" },
  problems: { label: "Problem", editAction: "problems_edit", base: "/problems" },
  changes: { label: "Change", editAction: "changes_edit", base: "/changes" },
  assets: { label: "Asset", editAction: "assets_edit", base: "/assets" },
  cmdb: { label: "CMDB", editAction: "cmdb_edit", base: "/cmdb" },
};

async function canUploadToModule(user, moduleKey) {
  const config = MODULE_CONFIG[moduleKey];
  if (!config) return false;
  return hasPermission(user.role, config.editAction);
}

function uploadAttachment(req, res) {
  upload(req, res, async (uploadErr) => {
    const moduleKey = req.params.module;
    const config = MODULE_CONFIG[moduleKey];
    const redirectBase = config ? `${config.base}/${req.params.recordId}` : "/";

    try {
      if (!config) throw new Error("Unknown module.");
      if (!mongoose.isValidObjectId(req.params.recordId)) throw new Error("Invalid record.");

      if (uploadErr) {
        if (uploadErr.code === "LIMIT_FILE_SIZE") throw new Error(`File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB per attachment).`);
        throw uploadErr;
      }
      if (!req.file) throw new Error("No file was selected.");

      const allowed = await canUploadToModule(req.user, moduleKey);
      if (!allowed) throw new Error(`You don't have permission to attach files to ${config.label} records.`);

      const attachmentId = await generateSequentialId("ATT");
      await Attachment.create({
        attachmentId,
        module: moduleKey,
        recordId: req.params.recordId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
        uploadedBy: req.user.email,
      });

      await logAudit({
        user: req.user._id,
        action: "Attachment Uploaded",
        entityType: config.label,
        entityId: req.params.recordId,
        details: req.file.originalname,
      });

      res.redirect(`${redirectBase}?message=${encodeURIComponent("Attachment uploaded.")}`);
    } catch (err) {
      res.redirect(`${redirectBase}?error=${encodeURIComponent(err.message)}`);
    }
  });
}

async function downloadAttachment(req, res) {
  const attachment = await Attachment.findOne({ attachmentId: req.params.attachmentId });
  if (!attachment) return res.status(404).render("errors/404");

  res.set("Content-Type", attachment.mimeType || "application/octet-stream");
  res.set("Content-Disposition", `inline; filename="${attachment.fileName.replace(/"/g, "")}"`);
  res.send(attachment.data);
}

module.exports = { MODULE_CONFIG, canUploadToModule, uploadAttachment, downloadAttachment };
