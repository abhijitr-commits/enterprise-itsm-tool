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
const { isAdminTeam, isHRTeam, isITTeam } = require("../utils/teamAccess");

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB — same shared-Atlas-tier reason as EmployeeDocument

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } }).single("file");

// Route-prefix module key -> { label matching the entityType strings
// already used across every controller's logAudit() calls, who's
// allowed to upload (editAction checked via the Permission Matrix, OR
// teamCheck for the 7 Admin-team modules below, which were never
// wired into the fine-grained Permission Matrix and already gate every
// other write with isAdminTeam — attachments follow the same rule
// rather than inventing new Permission Matrix actions for them), and
// where "back" points. The 7 Admin modules have no individual detail
// page (list + inline-action only, like Purchase Orders) — "base"
// points at the shared generic attachments page
// (adminAttachmentsController.js) instead of a per-record detail URL.
const MODULE_CONFIG = {
  incidents: { label: "Incident", editAction: "incidents_edit", base: "/incidents" },
  requests: { label: "Service Request", editAction: "requests_edit", base: "/requests" },
  problems: { label: "Problem", editAction: "problems_edit", base: "/problems" },
  changes: { label: "Change", editAction: "changes_edit", base: "/changes" },
  assets: { label: "Asset", editAction: "assets_edit", base: "/assets" },
  cmdb: { label: "CMDB", editAction: "cmdb_edit", base: "/cmdb" },
  "admin-assets": { label: "Admin Asset", teamCheck: isAdminTeam, base: "/admin-attachments/admin-assets" },
  "admin-purchases": { label: "Admin Purchase", teamCheck: isAdminTeam, base: "/admin-attachments/admin-purchases" },
  "admin-scrap": { label: "Scrap Item", teamCheck: isAdminTeam, base: "/admin-attachments/admin-scrap" },
  "admin-stock": { label: "Admin Stock Item", teamCheck: isAdminTeam, base: "/admin-attachments/admin-stock" },
  "admin-vendors": { label: "Admin Vendor", teamCheck: isAdminTeam, base: "/admin-attachments/admin-vendors" },
  "admin-helpdesk": { label: "Facility Helpdesk Request", teamCheck: isAdminTeam, base: "/admin-attachments/admin-helpdesk" },
  "admin-facility": { label: "Facility Task", teamCheck: isAdminTeam, base: "/admin-attachments/admin-facility" },

  // Attachment-coverage expansion pass — every other real content
  // module across HR Hub, IT Hub and Operations Hub, none of which had
  // file-attachment support before. None of these have their own
  // individual detail page with room for the attachments partial
  // embedded inline (same situation as the 7 Admin modules above), so
  // they all reuse the same generic "record attachments" page —
  // adminAttachmentsController.js's RECORD_CONFIG has the matching
  // entry for each key below. Where a module already has a specific
  // Permission Matrix action (see config/permissions.js), that's used
  // via editAction; where it doesn't, this follows the exact same
  // precedent the 7 Admin modules already set — team-check by
  // whichever hub the module belongs to, rather than inventing a new
  // Permission Matrix action just for attachments. Deliberately NOT
  // covered: EmployeeDocument (it IS a file store already — attaching
  // a file to a file record is redundant), Kudos/PulseSurvey (informal
  // wellness content, not the kind of record anyone attaches
  // supporting documents to), and ExitInterview/ITClearanceRecord
  // (sub-records of Resignation with no independent list page of their
  // own — reachable, and attachable, via the parent Resignation
  // record above).
  leave: { label: "Leave Request", editAction: "leave_approve", base: "/admin-attachments/leave" },
  resignations: { label: "Resignation", teamCheck: isHRTeam, base: "/admin-attachments/resignations" },
  candidates: { label: "Candidate", editAction: "recruitment_manage", base: "/admin-attachments/candidates" },
  "job-postings": { label: "Job Posting", editAction: "recruitment_manage", base: "/admin-attachments/job-postings" },
  referrals: { label: "Referral", editAction: "referrals_manage", base: "/admin-attachments/referrals" },
  goals: { label: "Goal", teamCheck: isHRTeam, base: "/admin-attachments/goals" },
  reviews: { label: "Performance Review", teamCheck: isHRTeam, base: "/admin-attachments/reviews" },
  succession: { label: "Succession Plan", editAction: "succession_manage", base: "/admin-attachments/succession" },
  courses: { label: "Course", editAction: "training_manage", base: "/admin-attachments/courses" },
  enrollments: { label: "Enrollment", editAction: "training_manage", base: "/admin-attachments/enrollments" },
  benefits: { label: "Benefit Enrollment", teamCheck: isHRTeam, base: "/admin-attachments/benefits" },
  "wellness-programs": { label: "Wellness Program", editAction: "wellness_manage", base: "/admin-attachments/wellness-programs" },
  policies: { label: "Policy", teamCheck: isHRTeam, base: "/admin-attachments/policies" },
  letters: { label: "Letter", teamCheck: isHRTeam, base: "/admin-attachments/letters" },

  "it-allocations": { label: "IT Allocation", teamCheck: isITTeam, base: "/admin-attachments/it-allocations" },
  "access-requests": { label: "Access Request", teamCheck: isITTeam, base: "/admin-attachments/access-requests" },
  vendors: { label: "Vendor", editAction: "vendors_edit", base: "/admin-attachments/vendors" },
  "vendor-service": { label: "Vendor Service Log", teamCheck: isITTeam, base: "/admin-attachments/vendor-service" },
  requirements: { label: "Requirement", teamCheck: isITTeam, base: "/admin-attachments/requirements" },
  stock: { label: "Stock Item", teamCheck: isITTeam, base: "/admin-attachments/stock" },
  licenses: { label: "Software License", teamCheck: isITTeam, base: "/admin-attachments/licenses" },

  "room-bookings": { label: "Room Booking", editAction: "rooms_manage", base: "/admin-attachments/room-bookings" },
  complaints: { label: "Complaint", editAction: "complaints_manage", base: "/admin-attachments/complaints" },
  maintenance: { label: "Maintenance Announcement", teamCheck: isAdminTeam, base: "/admin-attachments/maintenance" },
  expenses: { label: "Expense Claim", editAction: "expenses_approve", base: "/admin-attachments/expenses" },
  safety: { label: "Safety Incident", editAction: "safety_manage", base: "/admin-attachments/safety" },
  sales: { label: "Sales Order", editAction: "sales_edit", base: "/admin-attachments/sales" },
  "work-orders": { label: "Work Order", editAction: "workorders_edit", base: "/admin-attachments/work-orders" },
  ecr: { label: "Engineering Change Request", editAction: "ecr_decide", base: "/admin-attachments/ecr" },
  shipments: { label: "Shipment", editAction: "shipments_edit", base: "/admin-attachments/shipments" },
  "material-requests": { label: "Material Request", teamCheck: isAdminTeam, base: "/admin-attachments/material-requests" },
  "stock-orders": { label: "Stock Order", teamCheck: isAdminTeam, base: "/admin-attachments/stock-orders" },
};

async function canUploadToModule(user, moduleKey) {
  const config = MODULE_CONFIG[moduleKey];
  if (!config) return false;
  if (config.teamCheck) return config.teamCheck(user);
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
