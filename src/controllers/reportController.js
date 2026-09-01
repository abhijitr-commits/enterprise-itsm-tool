/*************************************************************
 * reportController.js — port of ReportEngine.gs, scoped to the
 * modules migrated so far (Incidents, Service Requests, Assets).
 * The HR-dependent reports in the original (Headcount, Attrition,
 * Training Completion, Contract Expiry, Executive Summary) need
 * the HR suite from Phase 4 first — see MIGRATION.md.
 *************************************************************/
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Asset = require("../models/Asset");
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

async function showReports(req, res) {
  const [incidents, requests, assets] = await Promise.all([
    Incident.find().lean(),
    ServiceRequest.find().lean(),
    Asset.find().lean(),
  ]);

  res.render("reports/index", {
    sla: slaComplianceReport(incidents),
    volume: monthlyVolumeReport(incidents),
    engineers: engineerPerformanceReport(incidents),
    aging: ticketAgingReport(incidents),
    workload: departmentWorkloadReport(incidents, requests),
    warranty: assetWarrantyReport(assets),
  });
}

module.exports = { showReports };
