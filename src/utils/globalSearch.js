/*************************************************************
 * globalSearch.js — port of RecordEngine.gs's globalSearch(keyword).
 * Started at the original 9 modules it always did (its own header
 * comment undersells this as "5 modules" but the actual code — the
 * source of truth — covers all 9): Incidents, Requests, Problems,
 * Changes, Assets, CMDB, Knowledge, Employees, Purchases — then grew
 * to cover the 7 Admin-team modules (Vendor Management, Stock, Scrap,
 * Asset Register, Purchase/Procurement, Facility Helpdesk, Facility
 * Ops Tasks), and now (as of the search-coverage expansion pass) every
 * other real content module across HR Hub, IT Hub, Operations Hub and
 * Wellness — everything with its own human-readable ID and worth
 * finding by keyword.
 *
 * Deliberately NOT indexed here: pure logs/audit trails (AuditLog,
 * AssetHistory, StockTransaction/AdminStockTransaction, PulseResponse,
 * PolicyAcknowledgment), master-data/config lookups (Category,
 * Department, Location, Room, Holiday, SLAMatrix, Setting, Permission,
 * Shift, Counter), thin sub-detail records with no independent view
 * (PreOnboardingDetail, ChecklistItem — task rows, not unique
 * records), CaptchaChallenge/PublicFormSubmission (internal to the
 * public intake flow, not signed-in content), and User (role/account
 * data — deliberately excluded from a keyword search every signed-in
 * user can run; Admin's own User Management page already covers it
 * for those who need it, and Employee below already covers the
 * general staff directory).
 *
 * Same per-module field matching as each module's own list-page
 * search, same 25-result cap, same "keyword must be at least 2
 * characters" guard.
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Problem = require("../models/Problem");
const Change = require("../models/Change");
const Asset = require("../models/Asset");
const ConfigurationItem = require("../models/ConfigurationItem");
const KnowledgeArticle = require("../models/KnowledgeArticle");
const Employee = require("../models/Employee");
const PurchaseOrder = require("../models/PurchaseOrder");
const AdminVendor = require("../models/AdminVendor");
const AdminStockItem = require("../models/AdminStockItem");
const AdminScrapItem = require("../models/AdminScrapItem");
const AdminAsset = require("../models/AdminAsset");
const AdminPurchase = require("../models/AdminPurchase");
const AdminComplaint = require("../models/AdminComplaint");
const AdminFacilityTask = require("../models/AdminFacilityTask");

// HR Hub
const LeaveRequest = require("../models/LeaveRequest");
const Resignation = require("../models/Resignation");
const ExitInterview = require("../models/ExitInterview");
const Candidate = require("../models/Candidate");
const JobPosting = require("../models/JobPosting");
const Referral = require("../models/Referral");
const Goal = require("../models/Goal");
const Review = require("../models/Review");
const SuccessionPlan = require("../models/SuccessionPlan");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Certificate = require("../models/Certificate");
const BenefitEnrollment = require("../models/BenefitEnrollment");
const WellnessProgram = require("../models/WellnessProgram");
const Kudos = require("../models/Kudos");
const PulseSurvey = require("../models/PulseSurvey");
const Policy = require("../models/Policy");
const Letter = require("../models/Letter");
const EmployeeDocument = require("../models/EmployeeDocument");

// IT Hub
const ITAllocation = require("../models/ITAllocation");
const ITClearanceRecord = require("../models/ITClearanceRecord");
const AccessRequest = require("../models/AccessRequest");
const Vendor = require("../models/Vendor");
const VendorServiceLog = require("../models/VendorServiceLog");
const Requirement = require("../models/Requirement");
const StockItem = require("../models/StockItem");
const SoftwareLicense = require("../models/SoftwareLicense");

// Operations Hub
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

const RESULT_CAP = 25;

async function globalSearch(keyword) {
  if (!keyword || keyword.trim().length < 2) return [];

  const rx = new RegExp(keyword.trim(), "i");
  const results = [];

  const [
    incidents, requests, problems, changes, assets, cis, articles, employees, purchases,
    adminVendors, adminStock, adminScrap, adminAssets, adminPurchases, adminHelpdesk, adminFacilityTasks,
    leave, resignations, exitInterviews, candidates, jobs, referrals, goals, reviews, succession,
    courses, enrollments, certificates, benefits, wellnessPrograms, kudos, pulseSurveys, policies, letters, employeeDocs,
    itAllocations, itClearances, accessRequests, vendors, vendorServiceLogs, requirements, stockItems, licenses,
    roomBookings, complaints, maintenance, expenses, safetyIncidents, salesOrders, workOrders, ecrs, shipments, materialRequests, adminStockOrders,
  ] = await Promise.all([
    Incident.find({ $or: ["incidentId", "employeeName", "department", "location", "category", "priority", "subject", "status", "engineer"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ServiceRequest.find({ $or: ["requestId", "requester", "department", "catalogItem", "details"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Problem.find({ $or: ["problemId", "title", "description", "owner", "linkedIncidents"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Change.find({ $or: ["changeId", "title", "requestedBy", "department", "riskLevel", "rootCause", "correctiveAction", "lessonsLearned"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Asset.find({ $or: ["assetId", "assetName", "type", "serialNumber", "assignedTo", "department", "location", "vendor"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ConfigurationItem.find({ $or: ["ciId", "ciName", "type", "ipAddress", "owner", "vlan", "subnet"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    KnowledgeArticle.find({ $or: ["articleId", "title", "content", "category"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Employee.find({ $or: ["employeeId", "name", "email", "department", "designation"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    PurchaseOrder.find({ $or: ["poId", "vendor", "itemDescription"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminVendor.find({ $or: ["name", "contactPerson", "email", "category"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminStockItem.find({ $or: ["itemId", "itemCode", "itemName", "category", "location"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminScrapItem.find({ $or: ["scrapId", "itemCode", "itemName", "category", "reason"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminAsset.find({ $or: ["assetId", "assetName", "type", "serialNumber", "assignedTo", "department", "location", "vendor"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminPurchase.find({ $or: ["poId", "itemDescription", "category", "vendor"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminComplaint.find({ $or: ["complaintId", "complainant", "department", "category", "subject", "description"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminFacilityTask.find({ $or: ["taskId", "taskName", "area", "assignedStaff"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),

    LeaveRequest.find({ $or: ["leaveId", "employee", "leaveType", "reason", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Resignation.find({ $or: ["resignationId", "employee", "department", "reason", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ExitInterview.find({ $or: ["interviewId", "resignationId", "employee", "primaryReason", "managerFeedback"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Candidate.find({ $or: ["candidateId", "jobId", "jobTitle", "name", "email", "stage"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    JobPosting.find({ $or: ["jobId", "title", "department", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Referral.find({ $or: ["referralId", "referrer", "candidateName", "candidateEmail", "jobTitle", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Goal.find({ $or: ["goalId", "employee", "goalTitle", "description", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Review.find({ $or: ["reviewId", "employee", "reviewPeriod", "reviewer", "strengths"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    SuccessionPlan.find({ $or: ["planId", "position", "currentHolder", "department", "successor1", "successor2"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Course.find({ $or: ["courseId", "title", "category", "provider", "description"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Enrollment.find({ $or: ["enrollmentId", "employee", "courseTitle", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Certificate.find({ $or: ["certificateId", "employee", "courseTitle"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    BenefitEnrollment.find({ $or: ["enrollmentId", "employee", "benefitType", "planName", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    WellnessProgram.find({ $or: ["programId", "title", "type", "description", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Kudos.find({ $or: ["kudosId", "from", "to", "message"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    PulseSurvey.find({ $or: ["surveyId", "question", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Policy.find({ $or: ["policyId", "policyName", "content"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Letter.find({ $or: ["letterId", "type", "recipientName", "recipientEmail"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    EmployeeDocument.find({ $or: ["documentId", "employee", "docType", "fileName"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),

    ITAllocation.find({ $or: ["allocationId", "employee", "department", "designation", "notes"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ITClearanceRecord.find({ $or: ["clearanceId", "resignationId", "employee", "notes"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AccessRequest.find({ $or: ["requestId", "employee", "system", "accessType", "justification", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Vendor.find({ $or: ["name", "contactPerson", "email", "category"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    VendorServiceLog.find({ $or: ["logId", "vendor", "issue", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Requirement.find({ $or: ["requirementId", "raisedBy", "department", "vendorName", "description", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    StockItem.find({ $or: ["itemId", "itemName", "category", "location"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    SoftwareLicense.find({ $or: ["licenseId", "softwareName", "vendor", "licenseType"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),

    RoomBooking.find({ $or: ["bookingId", "roomName", "bookedBy", "purpose"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Complaint.find({ $or: ["complaintId", "complainant", "department", "category", "subject", "description"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    MaintenanceAnnouncement.find({ $or: ["announcementId", "title", "description", "site"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ExpenseClaim.find({ $or: ["claimId", "employee", "department", "category", "description", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    SafetyIncident.find({ $or: ["safetyIncidentId", "reporter", "department", "location", "description", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    SalesOrder.find({ $or: ["salesOrderId", "customerName", "customerEmail", "itemDescription", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    WorkOrder.find({ $or: ["workOrderId", "department", "itemDescription", "status", "assignedTo"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    EngineeringChangeRequest.find({ $or: ["ecrId", "title", "department", "description", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Shipment.find({ $or: ["shipmentId", "carrier", "trackingNumber", "origin", "destination", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    MaterialRequest.find({ $or: ["materialRequestId", "requestedBy", "department", "itemName", "purpose", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    AdminStockOrder.find({ $or: ["orderId", "itemCode", "itemName", "status"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
  ]);

  incidents.forEach((r) => results.push({ module: "Incident", id: r._id, label: `${r.incidentId} — ${r.subject}`, sub: r.status, link: `/incidents/${r._id}` }));
  requests.forEach((r) => results.push({ module: "Service Request", id: r._id, label: `${r.requestId} — ${r.catalogItem}`, sub: r.fulfillmentStatus, link: `/requests/${r._id}` }));
  problems.forEach((r) => results.push({ module: "Problem", id: r._id, label: `${r.problemId} — ${r.title}`, sub: r.status, link: `/problems/${r._id}` }));
  changes.forEach((r) => results.push({ module: "Change", id: r._id, label: `${r.changeId} — ${r.title}`, sub: r.cabStatus, link: `/changes/${r._id}` }));
  assets.forEach((r) => results.push({ module: "Asset", id: r._id, label: `${r.assetId} — ${r.assetName}`, sub: r.status, link: `/assets/${r._id}` }));
  cis.forEach((r) => results.push({ module: "CMDB", id: r._id, label: `${r.ciId} — ${r.ciName}`, sub: r.status, link: `/cmdb/${r._id}` }));
  articles.forEach((r) => results.push({ module: "Knowledge", id: r._id, label: `${r.articleId} — ${r.title}`, sub: r.category, link: `/knowledge/${r._id}` }));
  employees.forEach((r) => results.push({ module: "Employee", id: r._id, label: `${r.employeeId} — ${r.name}`, sub: r.department, link: `/employees/${r._id}` }));
  // Purchases have no individual detail page (list + inline status
  // update only, per purchaseRoutes.js) — link to the register instead.
  purchases.forEach((r) => results.push({ module: "Purchase", id: r._id, label: `${r.poId} — ${r.itemDescription}`, sub: r.status, link: "/purchases" }));

  // None of the 7 Admin-team modules have an individual detail page
  // either (same list + inline-action pattern as Purchases above) —
  // every one of these links to its own register/list page.
  adminVendors.forEach((r) => results.push({ module: "Admin Vendor", id: r._id, label: r.name, sub: r.category, link: "/admin/vendors" }));
  adminStock.forEach((r) => results.push({ module: "Admin Stock", id: r._id, label: `${r.itemCode} — ${r.itemName}`, sub: r.category, link: "/admin/stock" }));
  adminScrap.forEach((r) => results.push({ module: "Scrap", id: r._id, label: `${r.scrapId} — ${r.itemName}`, sub: r.status, link: "/admin/scrap" }));
  adminAssets.forEach((r) => results.push({ module: "Admin Asset", id: r._id, label: `${r.assetId} — ${r.assetName}`, sub: r.status, link: "/admin/assets" }));
  adminPurchases.forEach((r) => results.push({ module: "Admin Purchase", id: r._id, label: `${r.poId} — ${r.itemDescription}`, sub: r.status, link: "/admin/purchases" }));
  adminHelpdesk.forEach((r) => results.push({ module: "Facility Helpdesk", id: r._id, label: `${r.complaintId} — ${r.subject}`, sub: r.status, link: "/admin/helpdesk" }));
  adminFacilityTasks.forEach((r) => results.push({ module: "Facility Task", id: r._id, label: `${r.taskId} — ${r.taskName}`, sub: r.status, link: "/admin/facility-tasks" }));

  // ---- HR Hub ----
  leave.forEach((r) => results.push({ module: "Leave Request", id: r._id, label: `${r.leaveId} — ${r.employee}`, sub: r.status, link: "/leave" }));
  resignations.forEach((r) => results.push({ module: "Resignation", id: r._id, label: `${r.resignationId} — ${r.employee}`, sub: r.status, link: `/resignations/${r._id}` }));
  // ExitInterview only stores the parent Resignation's human-readable
  // resignationId, not its Mongo _id, so this links to the Resignations
  // list rather than risking a broken direct link.
  exitInterviews.forEach((r) => results.push({ module: "Exit Interview", id: r._id, label: `${r.interviewId} — ${r.employee}`, sub: r.primaryReason, link: "/resignations" }));
  candidates.forEach((r) => results.push({ module: "Candidate", id: r._id, label: `${r.candidateId} — ${r.name}`, sub: r.stage, link: `/recruitment/${encodeURIComponent(r.jobId)}/candidates` }));
  jobs.forEach((r) => results.push({ module: "Job Posting", id: r._id, label: `${r.jobId} — ${r.title}`, sub: r.status, link: "/recruitment" }));
  referrals.forEach((r) => results.push({ module: "Referral", id: r._id, label: `${r.referralId} — ${r.candidateName}`, sub: r.status, link: "/referrals" }));
  goals.forEach((r) => results.push({ module: "Goal", id: r._id, label: `${r.goalId} — ${r.goalTitle}`, sub: r.status, link: "/performance/goals" }));
  reviews.forEach((r) => results.push({ module: "Review", id: r._id, label: `${r.reviewId} — ${r.employee}`, sub: r.reviewPeriod, link: "/performance/reviews" }));
  succession.forEach((r) => results.push({ module: "Succession Plan", id: r._id, label: `${r.planId} — ${r.position}`, sub: r.currentHolder, link: `/succession/${r._id}/edit` }));
  courses.forEach((r) => results.push({ module: "Course", id: r._id, label: `${r.courseId} — ${r.title}`, sub: r.status, link: "/training/courses" }));
  enrollments.forEach((r) => results.push({ module: "Enrollment", id: r._id, label: `${r.enrollmentId} — ${r.courseTitle}`, sub: r.status, link: "/training/enrollments" }));
  certificates.forEach((r) => results.push({ module: "Certificate", id: r._id, label: `${r.certificateId} — ${r.courseTitle}`, sub: r.employee, link: `/training/certificates/${r.certificateId}` }));
  benefits.forEach((r) => results.push({ module: "Benefit Enrollment", id: r._id, label: `${r.enrollmentId} — ${r.planName}`, sub: r.status, link: "/benefits" }));
  wellnessPrograms.forEach((r) => results.push({ module: "Wellness Program", id: r._id, label: `${r.programId} — ${r.title}`, sub: r.status, link: "/wellness/programs" }));
  kudos.forEach((r) => results.push({ module: "Kudos", id: r._id, label: `${r.from} → ${r.to}`, sub: r.message, link: "/wellness/kudos" }));
  pulseSurveys.forEach((r) => results.push({ module: "Pulse Survey", id: r._id, label: `${r.surveyId} — ${r.question}`, sub: r.status, link: "/wellness/pulse" }));
  policies.forEach((r) => results.push({ module: "Policy", id: r._id, label: `${r.policyId} — ${r.policyName}`, sub: `v${r.version}`, link: "/policies" }));
  letters.forEach((r) => results.push({ module: "Letter", id: r._id, label: `${r.letterId} — ${r.recipientName}`, sub: r.type, link: `/letters/${r.letterId}` }));
  employeeDocs.forEach((r) => results.push({ module: "Employee Document", id: r._id, label: `${r.documentId} — ${r.fileName}`, sub: r.docType, link: `/documents/${encodeURIComponent(r.employee)}` }));

  // ---- IT Hub ----
  itAllocations.forEach((r) => results.push({ module: "IT Allocation", id: r._id, label: `${r.allocationId} — ${r.employee}`, sub: r.department, link: "/asset-allocation" }));
  itClearances.forEach((r) => results.push({ module: "IT Clearance", id: r._id, label: `${r.clearanceId} — ${r.employee}`, sub: r.notes, link: `/it-clearance/${r.resignationId}` }));
  accessRequests.forEach((r) => results.push({ module: "Access Request", id: r._id, label: `${r.requestId} — ${r.system}`, sub: r.status, link: "/access-requests" }));
  vendors.forEach((r) => results.push({ module: "Vendor", id: r._id, label: r.name, sub: r.category, link: `/vendors/${r._id}/edit` }));
  vendorServiceLogs.forEach((r) => results.push({ module: "Vendor Service Log", id: r._id, label: `${r.logId} — ${r.vendor}`, sub: r.status, link: "/vendor-service" }));
  requirements.forEach((r) => results.push({ module: "Requirement", id: r._id, label: `${r.requirementId} — ${r.vendorName || r.description}`, sub: r.status, link: "/requirements" }));
  stockItems.forEach((r) => results.push({ module: "Stock Item", id: r._id, label: `${r.itemId} — ${r.itemName}`, sub: r.category, link: "/stock" }));
  licenses.forEach((r) => results.push({ module: "Software License", id: r._id, label: `${r.licenseId} — ${r.softwareName}`, sub: r.status, link: `/licenses/${r._id}/edit` }));

  // ---- Operations Hub ----
  roomBookings.forEach((r) => results.push({ module: "Room Booking", id: r._id, label: `${r.bookingId} — ${r.roomName}`, sub: r.status, link: "/rooms/bookings" }));
  complaints.forEach((r) => results.push({ module: "Complaint", id: r._id, label: `${r.complaintId} — ${r.subject}`, sub: r.status, link: "/complaints" }));
  maintenance.forEach((r) => results.push({ module: "Maintenance Announcement", id: r._id, label: `${r.announcementId} — ${r.title}`, sub: r.site, link: "/maintenance" }));
  expenses.forEach((r) => results.push({ module: "Expense Claim", id: r._id, label: `${r.claimId} — ${r.employee}`, sub: r.status, link: "/expenses" }));
  safetyIncidents.forEach((r) => results.push({ module: "Safety Incident", id: r._id, label: `${r.safetyIncidentId} — ${r.reporter}`, sub: r.status, link: "/safety" }));
  salesOrders.forEach((r) => results.push({ module: "Sales Order", id: r._id, label: `${r.salesOrderId} — ${r.customerName}`, sub: r.status, link: "/sales" }));
  workOrders.forEach((r) => results.push({ module: "Work Order", id: r._id, label: `${r.workOrderId} — ${r.itemDescription}`, sub: r.status, link: "/work-orders" }));
  ecrs.forEach((r) => results.push({ module: "Engineering Change Request", id: r._id, label: `${r.ecrId} — ${r.title}`, sub: r.status, link: "/engineering-changes" }));
  shipments.forEach((r) => results.push({ module: "Shipment", id: r._id, label: `${r.shipmentId} — ${r.trackingNumber || r.carrier || ""}`, sub: r.status, link: "/shipments" }));
  materialRequests.forEach((r) => results.push({ module: "Material Request", id: r._id, label: `${r.materialRequestId} — ${r.itemName}`, sub: r.status, link: "/material-requests" }));
  adminStockOrders.forEach((r) => results.push({ module: "Stock Order", id: r._id, label: `${r.orderId} — ${r.itemName}`, sub: r.status, link: "/admin/stock/orders" }));

  return results.slice(0, RESULT_CAP);
}

module.exports = { globalSearch, RESULT_CAP };
