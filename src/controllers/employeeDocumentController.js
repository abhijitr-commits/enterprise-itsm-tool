/*************************************************************
 * employeeDocumentController.js — port of EmployeeDocumentEngine.gs.
 * Per-employee document storage — ID proofs, certificates, offer
 * letters. See models/EmployeeDocument.js for the one real
 * architecture deviation in this migration: file bytes are stored
 * directly in MongoDB (this app's only always-available, already-free
 * piece of infrastructure) instead of a Google Drive folder, with a
 * 3MB-per-file cap to protect the shared 512MB free Atlas tier.
 *
 * Same ownership rule as the original throughout: any employee can
 * upload/view their OWN documents; the HR team can upload/view for
 * ANY employee (e.g. a signed offer letter HR received directly).
 *************************************************************/
const multer = require("multer");
const EmployeeDocument = require("../models/EmployeeDocument");
const Employee = require("../models/Employee");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { isHRTeam } = require("../utils/teamAccess");

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB — see models/EmployeeDocument.js for why this is tighter than the original's 10MB

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } }).single("file");

// Matches every other self-service module in this app (Goals, Profile,
// My Work): identity for "is this mine" comes from req.user.name, not a
// separate employee-record link.
function myEmployeeName(req) {
  return req.user.name;
}

async function showMyDocuments(req, res) {
  const docs = await EmployeeDocument.find({ employee: myEmployeeName(req) }).sort({ uploadDate: -1 }).lean();
  res.render("documents/list", {
    employeeName: myEmployeeName(req),
    isOwnPage: true,
    canUploadForOthers: isHRTeam(req.user),
    docs,
    error: req.query.error || null,
    message: req.query.message || null,
  });
}

async function showEmployeeDocuments(req, res) {
  const employeeName = decodeURIComponent(req.params.employeeName);
  const isOwn = employeeName.trim().toLowerCase() === myEmployeeName(req).trim().toLowerCase();

  if (!isOwn && !isHRTeam(req.user)) {
    return res.status(403).render("errors/403", { action: `${employeeName}'s documents` });
  }

  const docs = await EmployeeDocument.find({ employee: employeeName }).sort({ uploadDate: -1 }).lean();
  res.render("documents/list", {
    employeeName,
    isOwnPage: isOwn,
    canUploadForOthers: isHRTeam(req.user),
    docs,
    error: req.query.error || null,
    message: req.query.message || null,
  });
}

function uploadDocument(req, res) {
  upload(req, res, async (uploadErr) => {
    const employeeName = (req.body && req.body.employee) || myEmployeeName(req);
    const redirectBase = `/documents/${encodeURIComponent(employeeName)}`;

    try {
      if (uploadErr) {
        if (uploadErr.code === "LIMIT_FILE_SIZE") throw new Error(`File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB per document).`);
        throw uploadErr;
      }
      if (!req.file) throw new Error("No file was selected.");

      const isOwn = employeeName.trim().toLowerCase() === myEmployeeName(req).trim().toLowerCase();
      if (!isOwn && !isHRTeam(req.user)) {
        throw new Error("You can only upload your own documents. HR team can upload for any employee.");
      }

      const documentId = await generateSequentialId("DOC");
      const doc = await EmployeeDocument.create({
        documentId,
        employee: employeeName,
        docType: req.body.docType || "Other",
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
        uploadedBy: req.user.email,
      });

      await logAudit({ user: req.user._id, action: "Upload", entityType: "EmployeeDocument", entityId: doc._id, details: `${employeeName}: ${req.file.originalname}` });

      res.redirect(`${redirectBase}?message=Document Uploaded Successfully`);
    } catch (err) {
      res.redirect(`${redirectBase}?error=${encodeURIComponent(err.message)}`);
    }
  });
}

async function downloadDocument(req, res) {
  const doc = await EmployeeDocument.findOne({ documentId: req.params.documentId });
  if (!doc) return res.status(404).render("errors/404");

  const isOwn = doc.employee.trim().toLowerCase() === myEmployeeName(req).trim().toLowerCase();
  if (!isOwn && !isHRTeam(req.user)) {
    return res.status(403).render("errors/403", { action: "view this document" });
  }

  res.set("Content-Type", doc.mimeType || "application/octet-stream");
  res.set("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
  res.send(doc.data);
}

module.exports = { showMyDocuments, showEmployeeDocuments, uploadDocument, downloadDocument };
