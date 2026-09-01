/*************************************************************
 * executiveSummaryController.js — port of ReportEngine.gs's
 * getExecutiveSummarySafe(), the data behind the original's
 * ExecutiveSummary page — a one-screen, click-through roll-up
 * across ITSM + HR for Admin/Manager. Gated to "reports_view",
 * same as every other report.
 *
 * "Upcoming Expiries" only counts Asset Warranty + Contract Expiry
 * here — the original also included AMC and Software License
 * expiry (AMCEngine.gs/SoftwareLicenseEngine.gs), both Phase 5
 * modules not built yet (see MIGRATION.md). "New Hires This Month"
 * from the original is also skipped — its own comment already
 * admits it's not real "hired this month" data (no hire-date field
 * exists, just a simplified New/Active count), so it's a metric not
 * worth carrying forward inaccurately.
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Change = require("../models/Change");
const LeaveRequest = require("../models/LeaveRequest");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");
const Resignation = require("../models/Resignation");
const { STATUS, PRIORITY } = require("../config/constants");
const { APPROVAL } = require("../models/ServiceRequest");
const { departmentWorkloadReport, assetWarrantyReport, contractExpiryReport } = require("./reportController");

async function showExecutiveSummary(req, res) {
  const [incidents, requests, changes, leave, assets, employees, resignations] = await Promise.all([
    Incident.find().lean(),
    ServiceRequest.find().lean(),
    Change.find().lean(),
    LeaveRequest.find().lean(),
    Asset.find().lean(),
    Employee.find().lean(),
    Resignation.find().lean(),
  ]);

  const openIncidents = incidents.filter((r) => r.status !== STATUS.CLOSED && r.status !== STATUS.RESOLVED);
  const criticalOpen = openIncidents.filter((r) => r.priority === PRIORITY.CRITICAL);

  const pendingRequests = requests.filter((r) => r.approvalStatus === APPROVAL.PENDING);
  const pendingChanges = changes.filter((c) => c.cabStatus === APPROVAL.PENDING);
  const pendingLeave = leave.filter((l) => l.status === APPROVAL.PENDING);

  const activeEmployees = employees.filter((e) => e.status !== "Left");
  const pendingResignations = resignations.filter((r) => r.status !== "Completed");

  const warranties = assetWarrantyReport(assets);
  const contracts = contractExpiryReport(employees);

  const workload = departmentWorkloadReport(incidents, requests);
  const topDepartment = workload.length > 0 ? workload[0] : null;

  res.render("reports/executive-summary", {
    criticalOpen: criticalOpen.length,
    openIncidents: openIncidents.length,
    pendingApprovals: pendingRequests.length + pendingChanges.length + pendingLeave.length,
    pendingRequestsCount: pendingRequests.length,
    pendingChangesCount: pendingChanges.length,
    pendingLeaveCount: pendingLeave.length,
    upcomingExpiries: warranties.length + contracts.length,
    totalHeadcount: activeEmployees.length,
    pendingResignations: pendingResignations.length,
    topDepartment,
  });
}

module.exports = { showExecutiveSummary };
