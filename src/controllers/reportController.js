/*************************************************************
 * reportController.js — port of ReportEngine.gs. Contract Expiry
 * (needs the Employee Directory) and the Executive Summary (needs
 * Employees + Resignations + Leave, on top of everything Reports
 * already covers) were deferred until the HR suite existed — both
 * are wired up as of Phase 4F. Headcount/Attrition/Training-
 * Completion reports the original also had aren't ported yet (no
 * direct equivalent function existed to port from — see MIGRATION.md).
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Problem = require("../models/Problem");
const Change = require("../models/Change");
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");
const Vendor = require("../models/Vendor");
const SoftwareLicense = require("../models/SoftwareLicense");
const PurchaseOrder = require("../models/PurchaseOrder");
const ExpenseClaim = require("../models/ExpenseClaim");
const AdminVendor = require("../models/AdminVendor");
const AdminStockItem = require("../models/AdminStockItem");
const AdminStockOrder = require("../models/AdminStockOrder");
const AdminScrapItem = require("../models/AdminScrapItem");
const AdminAsset = require("../models/AdminAsset");
const AdminPurchase = require("../models/AdminPurchase");
const AdminComplaint = require("../models/AdminComplaint");
const AdminFacilityTask = require("../models/AdminFacilityTask");
const adminStockController = require("./adminStockController");
const { STATUS } = require("../config/constants");
const { slaStatusOf } = require("../utils/sla");
const { APPROVAL } = require("../models/ServiceRequest");
const { IMPL } = Change;

/**
 * Scalability fix (audit backlog item: "unbounded collection scans in
 * reportController.js/executiveSummaryController.js"). Incidents,
 * Service Requests, Problems, and Changes are append-only logs that
 * grow forever — showReports() used to Model.find().lean() every row
 * any of these four modules had ever accumulated, with no filter and
 * no limit at all. Fine at today's data volume; a real problem once a
 * few years of ticket history piles up.
 *
 * Every report on this page only ever needs two kinds of rows: (a)
 * whatever is still open, no matter how old — a five-year-old Critical
 * incident nobody closed still belongs in Ticket Aging — and (b)
 * anything from a trailing window, for trend/volume/MTTR-shaped
 * reports. Nothing here genuinely needs "every ticket this company
 * has ever filed" loaded into Node memory on every /reports request.
 * This is the same trailing-window default real ITSM reporting
 * dashboards use (e.g. ServiceNow Performance Analytics). Older,
 * fully-closed records stay reachable via CSV export — they just
 * aren't pulled into every report page load.
 */
const REPORT_WINDOW_MONTHS = 12;
function reportWindowStart() {
  const d = new Date();
  d.setMonth(d.getMonth() - REPORT_WINDOW_MONTHS);
  return d;
}
const OPEN_STATUSES = Object.values(STATUS).filter((s) => s !== STATUS.CLOSED && s !== STATUS.RESOLVED && s !== STATUS.CANCELLED);

/** Recent (within the trailing window) OR still-open, by the ticket's own status field. */
function recentOrOpen(statusField) {
  return { $or: [{ createdDate: { $gte: reportWindowStart() } }, { [statusField]: { $in: OPEN_STATUSES } }] };
}

/** Change has no single STATUS field — "open" means not CAB-rejected and not implementation-terminal. */
function recentOrOpenChange() {
  return {
    $or: [
      { createdDate: { $gte: reportWindowStart() } },
      { cabStatus: { $ne: APPROVAL.REJECTED }, implementationStatus: { $nin: [IMPL.IMPLEMENTED, IMPL.ROLLED_BACK] } },
    ],
  };
}

function slaComplianceReport(incidents) {
  return incidents.map((r) => ({
    incidentId: r.incidentId,
    subject: r.subject,
    priority: r.priority,
    status: r.status,
    engineer: r.engineer || "Unassigned",
    slaDue: r.slaDue ? new Date(r.slaDue).toLocaleString() : "",
    slaStatus: slaStatusOf(r),
  }));
}

function monthlyVolumeReport(incidents) {
  const counts = {};
  incidents.forEach((r) => {
    if (!r.createdDate) return;
    const d = new Date(r.createdDate);
    const key = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).map((month) => ({ month, count: counts[month] }));
}

function engineerPerformanceReport(incidents) {
  const stats = {};
  incidents.forEach((r) => {
    const eng = r.engineer || "Unassigned";
    if (!stats[eng]) stats[eng] = { engineer: eng, assigned: 0, closed: 0 };
    stats[eng].assigned++;
    if (r.status === STATUS.CLOSED || r.status === STATUS.RESOLVED) stats[eng].closed++;
  });
  return Object.values(stats);
}

function ticketAgingReport(incidents) {
  const now = new Date();
  return incidents
    .filter((r) => r.status !== STATUS.CLOSED && r.status !== STATUS.RESOLVED)
    .map((r) => {
      const created = new Date(r.createdDate);
      const ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      let bucket;
      if (ageDays <= 1) bucket = "0-1 days";
      else if (ageDays <= 3) bucket = "2-3 days";
      else if (ageDays <= 7) bucket = "4-7 days";
      else bucket = "8+ days";
      return {
        incidentId: r.incidentId,
        subject: r.subject,
        priority: r.priority,
        status: r.status,
        engineer: r.engineer || "Unassigned",
        ageDays,
        bucket,
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
}

function departmentWorkloadReport(incidents, requests) {
  const departments = {};
  incidents.forEach((r) => {
    const dept = r.department || "Unknown";
    if (!departments[dept]) departments[dept] = { department: dept, incidents: 0, requests: 0, openIncidents: 0 };
    departments[dept].incidents++;
    if (r.status !== STATUS.CLOSED && r.status !== STATUS.RESOLVED) departments[dept].openIncidents++;
  });
  requests.forEach((r) => {
    const dept = r.department || "Unknown";
    if (!departments[dept]) departments[dept] = { department: dept, incidents: 0, requests: 0, openIncidents: 0 };
    departments[dept].requests++;
  });
  return Object.values(departments).sort((a, b) => b.incidents + b.requests - (a.incidents + a.requests));
}

function assetWarrantyReport(assets) {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return assets
    .filter((r) => r.warrantyExpiry && new Date(r.warrantyExpiry) <= ninetyDaysOut)
    .map((r) => {
      const expiry = new Date(r.warrantyExpiry);
      return {
        assetId: r.assetId,
        assetName: r.assetName,
        type: r.type,
        department: r.department,
        vendor: r.vendor,
        warrantyExpiry: expiry.toLocaleDateString(),
        urgency: expiry < now ? "Expired" : "Expiring Soon",
      };
    })
    .sort((a, b) => new Date(a.warrantyExpiry) - new Date(b.warrantyExpiry));
}

/** Port of getContractExpiryReport() — Contract employees whose contractEndDate is within 30 days (including already-expired ones). */
function contractExpiryReport(employees) {
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return employees
    .filter((e) => e.employmentType === "Contract" && e.contractEndDate && new Date(e.contractEndDate) <= thirtyDaysOut)
    .map((e) => {
      const endDate = new Date(e.contractEndDate);
      return {
        employeeId: e.employeeId,
        name: e.name,
        department: e.department,
        designation: e.designation,
        contractEndDate: endDate.toLocaleDateString(),
        urgency: endDate < now ? "Expired" : "Expiring Soon",
      };
    })
    .sort((a, b) => new Date(a.contractEndDate) - new Date(b.contractEndDate));
}

/** Port of getAMCExpiryReport() (VendorEngine.gs) — same pattern as Asset Warranty and Contract Expiry, 90-day window. */
function amcExpiryReport(vendors) {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return vendors
    .filter((v) => v.amcExpiry && new Date(v.amcExpiry) <= ninetyDaysOut)
    .map((v) => {
      const expiry = new Date(v.amcExpiry);
      return {
        vendorName: v.name,
        category: v.category,
        amcExpiry: expiry.toLocaleDateString(),
        urgency: expiry < now ? "Expired" : "Expiring Soon",
      };
    })
    .sort((a, b) => new Date(a.amcExpiry) - new Date(b.amcExpiry));
}

/** Port of getLicenseExpiryReport() (SoftwareLicenseEngine.gs) — same 90-day pattern as AMC/Warranty. Unlike those two, the original put no permission check on this function at all; it's still surfaced only via the reports_view-gated Reports page here, same as every other report on it. */
function licenseExpiryReport(licenses) {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return licenses
    .filter((l) => l.expiryDate && new Date(l.expiryDate) <= ninetyDaysOut)
    .map((l) => {
      const expiry = new Date(l.expiryDate);
      return {
        softwareName: l.softwareName,
        vendor: l.vendor,
        expiryDate: expiry.toLocaleDateString(),
        urgency: expiry < now ? "Expired" : "Expiring Soon",
      };
    })
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
}

/**
 * Phase 9 addition — no equivalent in the original (its Asset Register
 * had no maintenance schedule to report on). Same 90-day-window/
 * "Expired vs Expiring Soon" shape as assetWarrantyReport() etc., but
 * driven by `nextMaintenanceDue` instead of `warrantyExpiry`, and
 * limited to assets that actually have a schedule set — an asset with
 * no `maintenanceIntervalDays` was never given one and shouldn't show
 * up as "expired."
 */
function maintenanceDueReport(assets) {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return assets
    .filter((a) => a.nextMaintenanceDue && new Date(a.nextMaintenanceDue) <= ninetyDaysOut)
    .map((a) => {
      const due = new Date(a.nextMaintenanceDue);
      return {
        assetId: a.assetId,
        assetName: a.assetName,
        hardwareType: a.hardwareType,
        department: a.department,
        nextMaintenanceDue: due.toLocaleDateString(),
        urgency: due < now ? "Overdue" : "Due Soon",
      };
    })
    .sort((a, b) => new Date(a.nextMaintenanceDue) - new Date(b.nextMaintenanceDue));
}

/**
 * Phase 9 addition — Fleet Reliability / MTBF report, no equivalent
 * in the original. Groups Incidents by their optional `relatedAsset`
 * free-text field (see models/Incident.js) and computes a simple Mean
 * Time Between Failures in days: (last incident − first incident) /
 * (count − 1), the standard MTBF definition when what's actually
 * being counted is "how often does this specific piece of equipment
 * generate a ticket" rather than true uptime telemetry (this app has
 * no sensor feed to compute real uptime from — it only knows about
 * tickets filed against equipment, same "derived from what's actually
 * recorded" honesty as every other report on this page).
 */
function assetReliabilityReport(incidents) {
  const byAsset = {};
  incidents.forEach((r) => {
    if (!r.relatedAsset) return;
    if (!byAsset[r.relatedAsset]) byAsset[r.relatedAsset] = [];
    byAsset[r.relatedAsset].push(new Date(r.createdDate));
  });

  return Object.entries(byAsset)
    .map(([relatedAsset, dates]) => {
      dates.sort((a, b) => a - b);
      const count = dates.length;
      const first = dates[0];
      const last = dates[count - 1];
      const mtbfDays = count > 1 ? Math.round((last - first) / (1000 * 60 * 60 * 24) / (count - 1)) : null;
      return {
        relatedAsset,
        incidentCount: count,
        firstIncident: first.toLocaleDateString(),
        lastIncident: last.toLocaleDateString(),
        mtbfDays,
      };
    })
    .sort((a, b) => b.incidentCount - a.incidentCount);
}

/**
 * Phase 10 addition — Finance & Spend Overview. No new model: reuses
 * existing Purchase Orders (outgoing spend on goods/vendors) and
 * Expense Claims (reimbursable spend by employees), grouped by month,
 * so Finance gets a genuine deliverable out of data every other
 * department is already generating rather than a whole new ledger
 * module. Purchases are counted regardless of status (an "Ordered"
 * PO is still a spend commitment); Expense Claims are counted only
 * once Approved or Reimbursed, since Pending/Rejected claims aren't
 * real spend yet.
 */
function financeSpendReport(purchases, expenses) {
  const byMonth = {};
  const monthKey = (d) => new Date(d).toLocaleString("en-US", { month: "short", year: "numeric" });

  purchases.forEach((p) => {
    if (!p.date) return;
    const key = monthKey(p.date);
    if (!byMonth[key]) byMonth[key] = { month: key, purchaseAmount: 0, purchaseCount: 0, expenseAmount: 0, expenseCount: 0 };
    byMonth[key].purchaseAmount += p.amount || 0;
    byMonth[key].purchaseCount++;
  });

  expenses
    .filter((e) => e.status === "Approved" || e.status === "Reimbursed")
    .forEach((e) => {
      if (!e.expenseDate && !e.submittedDate) return;
      const key = monthKey(e.expenseDate || e.submittedDate);
      if (!byMonth[key]) byMonth[key] = { month: key, purchaseAmount: 0, purchaseCount: 0, expenseAmount: 0, expenseCount: 0 };
      byMonth[key].expenseAmount += e.amount || 0;
      byMonth[key].expenseCount++;
    });

  return Object.values(byMonth)
    .map((r) => ({ ...r, totalAmount: r.purchaseAmount + r.expenseAmount }))
    .sort((a, b) => new Date(b.month) - new Date(a.month));
}

/**
 * Admin Stock — Critical/Low Items report. Reuses
 * adminStockController.js's withCurrentStock() (the same Issued/Used
 * (PC), Closing Stock (PC), Status calculation used on the Stock
 * Management page) instead of re-deriving it here, so the two never
 * drift apart — same cross-controller reuse pattern purchaseController.js
 * uses for assetController.js's logAssetHistory().
 */
async function adminStockCriticalReport(items) {
  const withStock = await adminStockController.withCurrentStock(items);
  return withStock
    .filter((i) => i.status === "CRITICAL")
    .map((i) => ({
      itemName: i.itemName,
      category: i.category,
      closingStock: i.closingStock,
      minBufferStock: i.minBufferStock,
      unit: i.unit,
      qtyToOrder: i.qtyToOrder,
      urgency: i.closingStock <= 0 ? "Out of Stock" : "Critical",
    }))
    .sort((a, b) => a.closingStock - b.closingStock);
}

/** Pending Stock Orders report — the order register's own "not yet received" queue, oldest first. */
function pendingStockOrdersReport(orders) {
  return orders
    .filter((o) => o.status === "Pending")
    .map((o) => ({
      orderId: o.orderId,
      itemCode: o.itemCode || "—",
      itemName: o.itemName,
      orderDate: o.orderDate ? new Date(o.orderDate).toLocaleDateString() : "—",
      raisedBy: o.raisedBy || "—",
    }))
    .sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
}

/** Scrap Management — entries awaiting approval, oldest first. */
function scrapPendingApprovalReport(scrapItems) {
  return scrapItems
    .filter((s) => s.status === "Pending Approval")
    .map((s) => ({
      scrapId: s.scrapId,
      itemName: s.itemName,
      category: s.category,
      quantity: `${s.quantity} ${s.unit}`,
      reason: s.reason,
      scrapDate: s.scrapDate ? new Date(s.scrapDate).toLocaleDateString() : "—",
      raisedBy: s.raisedBy || "—",
    }))
    .sort((a, b) => new Date(a.scrapDate) - new Date(b.scrapDate));
}

/** Admin Asset Register warranty expiry — reuses assetWarrantyReport() since AdminAsset shares the same field shape as Asset. */

/** Pending Purchase Approvals — the procurement register's own "awaiting decision" queue, oldest first. */
function pendingPurchaseApprovalsReport(purchases) {
  return purchases
    .filter((p) => p.status === "Pending Approval")
    .map((p) => ({
      poId: p.poId,
      itemDescription: p.itemDescription,
      category: p.category,
      quantity: p.quantity,
      estimatedAmount: p.estimatedAmount,
      vendor: p.vendor || "—",
      raisedBy: p.raisedBy || "—",
    }))
    .sort((a, b) => a.poId < b.poId ? -1 : 1);
}

/** Admin Facility Helpdesk — open/in-progress requests, oldest first. */
function openFacilityHelpdeskReport(complaints) {
  return complaints
    .filter((c) => c.status === "Open" || c.status === "In Progress")
    .map((c) => ({
      complaintId: c.complaintId,
      complainant: c.complainant,
      category: c.category,
      subject: c.subject,
      status: c.status,
      createdDate: c.createdDate ? new Date(c.createdDate).toLocaleDateString() : "—",
    }))
    .sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate));
}

/** Facility Ops Tasks — pending tasks due, soonest first. */
function pendingFacilityTasksReport(tasks) {
  return tasks
    .filter((t) => t.status === "Pending")
    .map((t) => ({
      taskId: t.taskId,
      taskName: t.taskName,
      area: t.area,
      assignedStaff: t.assignedStaff || "—",
      frequency: t.frequency,
      scheduledDate: t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString() : "—",
    }))
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
}

/**
 * Architecture Phase 3 addition (see itsm_architecture_comparison.md) —
 * combined ticket-volume trend across all four core ticket modules,
 * last 6 calendar months (oldest first), for the Reports page's new BI
 * Dashboard section. Same idea as monthlyVolumeReport() above but
 * merges Incidents/Requests/Problems/Changes into one comparable trend
 * instead of Incidents alone.
 */
function ticketVolumeTrend(incidents, requests, problems, changes) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString("en-US", { month: "short", year: "numeric" }));
  }
  const base = () => Object.fromEntries(months.map((m) => [m, 0]));
  const counts = { incidents: base(), requests: base(), problems: base(), changes: base() };

  function tally(rows, key) {
    rows.forEach((r) => {
      if (!r.createdDate) return;
      const m = new Date(r.createdDate).toLocaleString("en-US", { month: "short", year: "numeric" });
      if (m in counts[key]) counts[key][m]++;
    });
  }
  tally(incidents, "incidents");
  tally(requests, "requests");
  tally(problems, "problems");
  tally(changes, "changes");

  return months.map((m) => ({
    month: m,
    incidents: counts.incidents[m],
    requests: counts.requests[m],
    problems: counts.problems[m],
    changes: counts.changes[m],
    total: counts.incidents[m] + counts.requests[m] + counts.problems[m] + counts.changes[m],
  }));
}

/**
 * Architecture Phase 3 addition — aggregates slaComplianceReport()'s
 * per-incident output into the Met/Breached/At Risk/On Track counts
 * the new SLA Compliance donut needs, plus an overall compliance %
 * (Met / (Met + Breached), since On Track/At Risk haven't finished yet
 * so counting them either way would understate or overstate compliance).
 */
function slaComplianceSummary(slaRows) {
  const counts = { Met: 0, Breached: 0, "At Risk": 0, "On Track": 0 };
  slaRows.forEach((r) => {
    if (counts[r.slaStatus] !== undefined) counts[r.slaStatus]++;
  });
  const decided = counts.Met + counts.Breached;
  const compliancePct = decided > 0 ? Math.round((counts.Met / decided) * 100) : null;
  return { ...counts, decided, compliancePct };
}

/**
 * Architecture Phase 3 addition — Mean Time To Resolve, in hours, for
 * Incidents that have both a createdDate and a closedDate. Trended by
 * month (last 6 months) plus an all-time overall average — no
 * equivalent existed anywhere in this app before (SLA Compliance only
 * tracks met-vs-breached against the SLA due date, not actual
 * resolution speed).
 */
function mttrReport(incidents) {
  const resolved = incidents.filter((r) => r.createdDate && r.closedDate);
  const hoursFor = (r) => (new Date(r.closedDate) - new Date(r.createdDate)) / (1000 * 60 * 60);

  const overallAvg = resolved.length ? Math.round(resolved.reduce((sum, r) => sum + hoursFor(r), 0) / resolved.length) : null;

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString("en-US", { month: "short", year: "numeric" }));
  }
  const byMonth = Object.fromEntries(months.map((m) => [m, { sum: 0, count: 0 }]));
  resolved.forEach((r) => {
    const m = new Date(r.closedDate).toLocaleString("en-US", { month: "short", year: "numeric" });
    if (byMonth[m]) {
      byMonth[m].sum += hoursFor(r);
      byMonth[m].count++;
    }
  });

  const trend = months.map((m) => ({
    month: m,
    avgHours: byMonth[m].count ? Math.round(byMonth[m].sum / byMonth[m].count) : 0,
    count: byMonth[m].count,
  }));

  return { overallAvg, resolvedCount: resolved.length, trend };
}

/**
 * Architecture Phase 3 addition — Change Failure Rate, the standard
 * DevOps/ITSM health metric (% of completed changes that had to be
 * rolled back). Only counts changes that actually reached a terminal
 * implementation state (Implemented or Rolled Back) — a change still
 * Not Started/In Progress hasn't succeeded or failed yet. Directly
 * powered by this week's rollback PIR feature (Change.implementationStatus
 * plus rootCause/correctiveAction/lessonsLearned), so this number now
 * means something instead of being unmeasurable.
 */
function changeFailureRateReport(changes) {
  const implemented = changes.filter((c) => c.implementationStatus === "Implemented").length;
  const rolledBack = changes.filter((c) => c.implementationStatus === "Rolled Back").length;
  const completed = implemented + rolledBack;
  const failureRatePct = completed > 0 ? Math.round((rolledBack / completed) * 100) : null;
  return { implemented, rolledBack, completed, failureRatePct };
}

async function showReports(req, res) {
  const [
    incidents, requests, problems, changes, assets, employees, vendors, licenses, purchases, expenses,
    adminVendors, adminStockItems, adminStockOrders, adminScrapItems,
    adminAssets, adminPurchases, adminComplaints, adminFacilityTasks,
  ] = await Promise.all([
    Incident.find(recentOrOpen("status")).lean(),
    ServiceRequest.find(recentOrOpen("fulfillmentStatus")).lean(),
    Problem.find(recentOrOpen("status")).lean(),
    Change.find(recentOrOpenChange()).lean(),
    Asset.find().lean(),
    Employee.find().lean(),
    Vendor.find().lean(),
    SoftwareLicense.find().lean(),
    PurchaseOrder.find().lean(),
    ExpenseClaim.find().lean(),
    AdminVendor.find().lean(),
    AdminStockItem.find().lean(),
    AdminStockOrder.find().lean(),
    AdminScrapItem.find().lean(),
    AdminAsset.find().lean(),
    AdminPurchase.find().lean(),
    AdminComplaint.find().lean(),
    AdminFacilityTask.find().lean(),
  ]);

  const adminStockCritical = await adminStockCriticalReport(adminStockItems);

  // Architecture Phase 3 — BI Dashboard section, computed once here and
  // rendered as charts (not tables) at the top of reports/index.ejs.
  const slaRows = slaComplianceReport(incidents);

  res.render("reports/index", {
    biVolumeTrend: ticketVolumeTrend(incidents, requests, problems, changes),
    biSlaSummary: slaComplianceSummary(slaRows),
    biMttr: mttrReport(incidents),
    biChangeFailureRate: changeFailureRateReport(changes),
    sla: slaRows,
    volume: monthlyVolumeReport(incidents),
    engineers: engineerPerformanceReport(incidents),
    aging: ticketAgingReport(incidents),
    workload: departmentWorkloadReport(incidents, requests),
    warranty: assetWarrantyReport(assets),
    contracts: contractExpiryReport(employees),
    amcs: amcExpiryReport(vendors),
    licenses: licenseExpiryReport(licenses),
    maintenanceDue: maintenanceDueReport(assets),
    fleetReliability: assetReliabilityReport(incidents),
    financeSpend: financeSpendReport(purchases, expenses),
    adminAmcs: amcExpiryReport(adminVendors),
    adminStockCritical,
    adminPendingOrders: pendingStockOrdersReport(adminStockOrders),
    adminScrapPending: scrapPendingApprovalReport(adminScrapItems),
    adminAssetWarranty: assetWarrantyReport(adminAssets),
    adminPendingPurchases: pendingPurchaseApprovalsReport(adminPurchases),
    adminHelpdeskOpen: openFacilityHelpdeskReport(adminComplaints),
    adminFacilityTasksPending: pendingFacilityTasksReport(adminFacilityTasks),
  });
}

module.exports = {
  showReports,
  recentOrOpen,
  recentOrOpenChange,
  ticketVolumeTrend,
  slaComplianceSummary,
  mttrReport,
  changeFailureRateReport,
  departmentWorkloadReport,
  assetWarrantyReport,
  contractExpiryReport,
  amcExpiryReport,
  licenseExpiryReport,
  maintenanceDueReport,
  assetReliabilityReport,
  financeSpendReport,
  adminStockCriticalReport,
  pendingStockOrdersReport,
  scrapPendingApprovalReport,
  pendingPurchaseApprovalsReport,
  openFacilityHelpdeskReport,
  pendingFacilityTasksReport,
};
