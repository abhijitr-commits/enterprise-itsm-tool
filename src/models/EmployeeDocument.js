const mongoose = require("mongoose");

/**
 * Field-for-field port of the "Employee Documents" sheet
 * (EmployeeDocumentEngine.gs) — ID proofs, certificates, offer
 * letters, one per employee. The original stored the actual FILE in
 * a Google Drive folder (getOrCreateEmployeeDocsFolder()) and kept
 * only Drive URLs in the sheet: Document ID | Employee | Document
 * Type | File Name | Drive URL | Uploaded By | Upload Date.
 *
 * ARCHITECTURE NOTE — this is the one deliberate infrastructure
 * substitution in this migration, so it's worth explaining plainly:
 * this app has no Google Drive (or any other file-hosting account)
 * to store files in, and the standing requirement is zero new paid
 * or free-tier third-party accounts. Rather than deferring this
 * module entirely (the path taken for PreOnboardingDetailEngine.gs's
 * document vault and AttachmentEngine.gs, both waiting on the SAME
 * problem — see MIGRATION.md), the file bytes are stored directly in
 * the `data` field below, inside the MongoDB Atlas cluster this app
 * already has. No new account, no new setup step — it just works the
 * first time someone uploads a document.
 *
 * The tradeoff: the free Atlas M0 tier caps the whole database at
 * 512MB shared across every module, not just documents, so the
 * original's 10MB-per-file cap is tightened to 3MB here (see
 * controllers/employeeDocumentController.js) to keep this from
 * crowding out everything else. That's a real, permanent constraint
 * of staying on 100% free infrastructure — genuinely fine for ID
 * scans and short letters, not for a real document archive at scale.
 * If that ever becomes a problem, swapping `data` for a URL into a
 * real object-storage free tier (e.g. Cloudflare R2) is a contained
 * change to this model + controller, nothing else.
 */
const employeeDocumentSchema = new mongoose.Schema(
  {
    documentId: { type: String, unique: true, index: true }, // DOC-YYYY-000001
    employee: { type: String, required: true, trim: true },
    docType: { type: String, trim: true, default: "Other" },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
    data: { type: Buffer, required: true },
    uploadedBy: { type: String, trim: true },
  },
  { timestamps: { createdAt: "uploadDate", updatedAt: false } }
);

employeeDocumentSchema.index({ employee: 1 });

module.exports = mongoose.model("EmployeeDocument", employeeDocumentSchema);
