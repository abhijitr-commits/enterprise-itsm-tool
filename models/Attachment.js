const mongoose = require("mongoose");

/**
 * Port of AttachmentEngine.gs — lets Incidents, Service Requests,
 * Problems, Changes, Assets, and CMDB Configuration Items each carry
 * file attachments (screenshots, quotes, RCA documents, etc.). The
 * original stored files in one shared Drive folder with per-record
 * subfolders and kept an "Attachments" sheet of metadata: Attachment
 * ID | Module | Record ID | File Name | Drive URL | Uploaded By |
 * Upload Date.
 *
 * Same architecture deviation as EmployeeDocument.js (see that file's
 * long comment for the full reasoning): no Drive/S3 account is allowed
 * under this project's standing "zero new third-party accounts" rule,
 * so the file bytes live directly in this MongoDB collection instead,
 * with the same 3MB-per-file cap (tightened from the original's 10MB)
 * to protect the shared 512MB Atlas free tier.
 */
const attachmentSchema = new mongoose.Schema(
  {
    attachmentId: { type: String, unique: true, index: true }, // ATT-YYYY-000001

    // Route-prefix module key (e.g. "incidents", "changes") rather than
    // a display label — keeps lookups exact and matches how every other
    // module-scoped collection in this app is keyed. Display labels are
    // resolved from MODULE_CONFIG in controllers/attachmentController.js.
    module: { type: String, required: true, trim: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },

    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
    data: { type: Buffer, required: true },
    uploadedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "uploadDate", updatedAt: false } }
);

attachmentSchema.index({ module: 1, recordId: 1 });

module.exports = mongoose.model("Attachment", attachmentSchema);
