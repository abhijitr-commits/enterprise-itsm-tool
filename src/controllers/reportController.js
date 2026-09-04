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
const Asset = require("../models/Asset");
const Employee = require("../models/Employee");
const Vendor = require("../models/Vendor");
const SoftwareLicense = require("../models/SoftwareLicense");
const PurchaseOrder = require("../models/PurchaseOrder");
const ExpenseClaim = require("../models/ExpenseClaim");
const { STATUS } = require("../config/constants");

function slaComplianceReport(incidents) {
  const now = new Date();
  return incidents.map((r) => {
    let slaStatus = "On Track";
    const slaDue = r.slaDue ? new Date(r.slaDue) : null;
    const closedDate = r.closedDate ? new Date(r.closedDate) : null;

    if (r.status === STATUS.CLOSED || r.status === STATUS.RESOLVED) {
      slaStatus = slaDue && closedDate ? (closedDate <= slaDue ? "Met" : "Breached") : "Met";
    } else if (slaDue) {
      const hoursRemaining = (slaDue.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursRemaining < 0) slaStatus = "Breached";
      else if (hoursRemaining <= 4) slaStatus = "At Risk";
    }

    return {
      incidentId: r.incidentId,
      subject: r.subject,
      priority: r.priority,
      status: r.status,
      engineer: r.engineer || "Unassigned",
      slaDue: r.slaDue ? new Date(r.slaDue).toLocaleString() : "",
      slaStatus,
    };
  });
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

async function showReports(req, res) {
  const [incidents, requests, assets, employees, vendors, licenses, purchases, expenses] = await Promise.all([
    Incident.find().lean(),
    ServiceRequest.find().lean(),
    Asset.find().lean(),
    Employee.find().lean(),
    Vendor.find().lean(),
    SoftwareLicense.find().lean(),
    PurchaseOrder.find().lean(),
    ExpenseClaim.find().lean(),
  ]);

  res.render("reports/index", {
    sla: slaComplianceReport(incidents),
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
  });
}

module.exports = {
  showReports,
  departmentWorkloadReport,
  assetWarrantyReport,
  contractExpiryReport,
  amcExpiryReport,
  licenseExpiryReport,
  maintenanceDueReport,
  assetReliabilityReport,
  financeSpendReport,
};
