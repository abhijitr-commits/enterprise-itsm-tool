/*************************************************************
 * adminAttachmentsController.js — attachment support for every
 * module without its own individual record detail page (list +
 * inline-action only, same pattern as Purchase Orders): the 7
 * Admin-team modules this started with, plus (as of the attachment-
 * coverage expansion pass) every other HR/IT/Operations Hub module
 * that reached the same situation. Rather than build dozens of
 * bespoke detail pages just to host an upload/download panel, this is
 * ONE small generic "record attachments" page reused by all of them —
 * the same approach as the CSV export/import engine
 * (utils/csvRegistry.js): one implementation, a small per-module
 * config table. The route/file name still says "admin" from when it
 * only covered Admin-team modules; it's open to any signed-in user
 * now, gated per-module the same way attachmentController.js's own
 * MODULE_CONFIG gates uploads — renaming it would touch a lot of
 * incoming links for no functional gain, so it was left as-is.
 *
 * Reuses utils/recordExtras.js's getAttachmentsForRecord() and
 * partials/attachments.ejs exactly as every core-ITSM detail page
 * does; upload/download themselves still go through the existing
 * generic attachmentRoutes.js / attachmentController.js — this
 * controller only renders the page that hosts that partial and
 * resolves a human-readable record label to show at the top.
 *************************************************************/
const { getAttachmentsForRecord } = require("../utils/recordExtras");
const { canUploadToModule } = require("./attachmentController");
const AdminAsset = require("../models/AdminAsset");
const AdminPurchase = require("../models/AdminPurchase");
const AdminScrapItem = require("../models/AdminScrapItem");
const AdminStockItem = require("../models/AdminStockItem");
const AdminVendor = require("../models/AdminVendor");
const AdminComplaint = require("../models/AdminComplaint");
const AdminFacilityTask = require("../models/AdminFacilityTask");

// HR/IT/Ops modules from the attachment-coverage expansion pass — see
// the long comment on attachmentController.js's MODULE_CONFIG for why
// each one is keyed the way it is and checked the way it is.
const LeaveRequest = require("../models/LeaveRequest");
const Resignation = require("../models/Resignation");
const Candidate = require("../models/Candidate");
const JobPosting = require("../models/JobPosting");
const Referral = require("../models/Referral");
const Goal = require("../models/Goal");
const Review = require("../models/Review");
const SuccessionPlan = require("../models/SuccessionPlan");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const BenefitEnrollment = require("../models/BenefitEnrollment");
const WellnessProgram = require("../models/WellnessProgram");
const Policy = require("../models/Policy");
const Letter = require("../models/Letter");
const ITAllocation = require("../models/ITAllocation");
const AccessRequest = require("../models/AccessRequest");
const Vendor = require("../models/Vendor");
const VendorServiceLog = require("../models/VendorServiceLog");
const Requirement = require("../models/Requirement");
const StockItem = require("../models/StockItem");
const SoftwareLicense = require("../models/SoftwareLicense");
const RoomBooking = require("../models/RoomBooking");
const Complaint = require("../models/Complaint");
const MaintenanceAnnouncement = require("../models/MaintenanceAnnouncement");
const ExpenseClaim = require("../models/ExpenseClaim");
const SafetyIncident = require("../models/SafetyIncident");
const SalesOrder = require("../models/SalesOrder");
const WorkOrder = require("../models/WorkOrder");
const EngineeringChangeRequest = require("../models/EngineeringChangeRequest");
const Shipment = require("../models/Shipment");
const MaterialRequest = require("../models/MaterialRequest");
const AdminStockOrder = require("../models/AdminStockOrder");

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

  leave: { model: LeaveRequest, idField: "leaveId", labelField: "employee", listPath: "/leave", listLabel: "Leave Requests" },
  resignations: { model: Resignation, idField: "resignationId", labelField: "employee", listPath: "/resignations", listLabel: "Resignations" },
  candidates: { model: Candidate, idField: "candidateId", labelField: "name", listPath: "/recruitment", listLabel: "Recruitment" },
  "job-postings": { model: JobPosting, idField: "jobId", labelField: "title", listPath: "/recruitment", listLabel: "Recruitment" },
  referrals: { model: Referral, idField: "referralId", labelField: "candidateName", listPath: "/referrals", listLabel: "Referrals" },
  goals: { model: Goal, idField: "goalId", labelField: "goalTitle", listPath: "/performance/goals", listLabel: "Performance Goals" },
  reviews: { model: Review, idField: "reviewId", labelField: "employee", listPath: "/performance/reviews", listLabel: "Performance Reviews" },
  succession: { model: SuccessionPlan, idField: "planId", labelField: "position", listPath: "/succession", listLabel: "Succession Planning" },
  courses: { model: Course, idField: "courseId", labelField: "title", listPath: "/training/courses", listLabel: "Training Courses" },
  enrollments: { model: Enrollment, idField: "enrollmentId", labelField: "courseTitle", listPath: "/training/enrollments", listLabel: "Training Enrollments" },
  benefits: { model: BenefitEnrollment, idField: "enrollmentId", labelField: "planName", listPath: "/benefits", listLabel: "Benefits" },
  "wellness-programs": { model: WellnessProgram, idField: "programId", labelField: "title", listPath: "/wellness/programs", listLabel: "Wellness Programs" },
  policies: { model: Policy, idField: "policyId", labelField: "policyName", listPath: "/policies", listLabel: "Policies" },
  letters: { model: Letter, idField: "letterId", labelField: "recipientName", listPath: "/letters", listLabel: "Letters" },

  "it-allocations": { model: ITAllocation, idField: "allocationId", labelField: "employee", listPath: "/asset-allocation", listLabel: "IT Asset Allocation" },
  "access-requests": { model: AccessRequest, idField: "requestId", labelField: "employee", listPath: "/access-requests", listLabel: "Access Requests" },
  vendors: { model: Vendor, idField: null, labelField: "name", listPath: "/vendors", listLabel: "Vendors" },
  "vendor-service": { model: VendorServiceLog, idField: "logId", labelField: "vendor", listPath: "/vendor-service", listLabel: "Vendor Service Log" },
  requirements: { model: Requirement, idField: "requirementId", labelField: "vendorName", listPath: "/requirements", listLabel: "Requirement Requests" },
  stock: { model: StockItem, idField: "itemId", labelField: "itemName", listPath: "/stock", listLabel: "Stock Management" },
  licenses: { model: SoftwareLicense, idField: "licenseId", labelField: "softwareName", listPath: "/licenses", listLabel: "Software Licenses" },

  "room-bookings": { model: RoomBooking, idField: "bookingId", labelField: "roomName", listPath: "/rooms/bookings", listLabel: "Room Bookings" },
  complaints: { model: Complaint, idField: "complaintId", labelField: "subject", listPath: "/complaints", listLabel: "Complaints" },
  maintenance: { model: MaintenanceAnnouncement, idField: "announcementId", labelField: "title", listPath: "/maintenance", listLabel: "Maintenance Announcements" },
  expenses: { model: ExpenseClaim, idField: "claimId", labelField: "employee", listPath: "/expenses", listLabel: "Expense Claims" },
  safety: { model: SafetyIncident, idField: "safetyIncidentId", labelField: "reporter", listPath: "/safety", listLabel: "Safety Incidents" },
  sales: { model: SalesOrder, idField: "salesOrderId", labelField: "customerName", listPath: "/sales", listLabel: "Sales Orders" },
  "work-orders": { model: WorkOrder, idField: "workOrderId", labelField: "itemDescription", listPath: "/work-orders", listLabel: "Work Orders" },
  ecr: { model: EngineeringChangeRequest, idField: "ecrId", labelField: "title", listPath: "/engineering-changes", listLabel: "Engineering Change Requests" },
  shipments: { model: Shipment, idField: "shipmentId", labelField: "trackingNumber", listPath: "/shipments", listLabel: "Shipments" },
  "material-requests": { model: MaterialRequest, idField: "materialRequestId", labelField: "itemName", listPath: "/material-requests", listLabel: "Material Requests" },
  "stock-orders": { model: AdminStockOrder, idField: "orderId", labelField: "itemName", listPath: "/admin/stock/orders", listLabel: "Stock Orders" },
};

async function showAttachments(req, res) {
  const { moduleKey, recordId } = req.params;
  const config = RECORD_CONFIG[moduleKey];
  if (!config) return res.status(404).render("errors/404");

  const record = await config.model.findById(recordId).lean();
  if (!record) return res.status(404).render("errors/404");

  const [attachments, canUpload] = await Promise.all([
    getAttachmentsForRecord(moduleKey, recordId),
    // Same eligibility check uploadAttachment() itself enforces server-side
    // (attachmentController.js's MODULE_CONFIG) — reused here so the
    // upload form only shows for people who could actually submit it,
    // across every module's own editAction/teamCheck rule rather than
    // one hardcoded isAdminTeam check that no longer fits all 20+ modules
    // this generic page now serves.
    canUploadToModule(req.user, moduleKey),
  ]);
  const recordLabel = `${config.idField && record[config.idField] ? record[config.idField] + " — " : ""}${record[config.labelField] || ""}`;

  res.render("admin-shared/attachments", {
    moduleKey,
    recordId,
    recordLabel,
    listPath: config.listPath,
    listLabel: config.listLabel,
    attachments,
    canUpload,
    message: req.query.message || null,
    error: req.query.error || null,
  });
}

module.exports = { showAttachments, RECORD_CONFIG };
