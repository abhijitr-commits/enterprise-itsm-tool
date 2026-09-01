/*************************************************************
 * globalSearch.js — port of RecordEngine.gs's globalSearch(keyword).
 * Searches the same 9 modules the original did (its own header
 * comment undersells this as "5 modules" but the actual code — the
 * source of truth — covers all 9): Incidents, Requests, Problems,
 * Changes, Assets, CMDB, Knowledge, Employees, Purchases. Same
 * per-module field matching as each module's own list-page search,
 * same 25-result cap, same "keyword must be at least 2 characters"
 * guard.
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

const RESULT_CAP = 25;

async function globalSearch(keyword) {
  if (!keyword || keyword.trim().length < 2) return [];

  const rx = new RegExp(keyword.trim(), "i");
  const results = [];

  const [incidents, requests, problems, changes, assets, cis, articles, employees, purchases] = await Promise.all([
    Incident.find({ $or: ["incidentId", "employeeName", "department", "location", "category", "priority", "subject", "status", "engineer"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ServiceRequest.find({ $or: ["requestId", "requester", "department", "catalogItem", "details"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Problem.find({ $or: ["problemId", "title", "description", "owner", "linkedIncidents"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Change.find({ $or: ["changeId", "title", "requestedBy", "department", "riskLevel"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Asset.find({ $or: ["assetId", "assetName", "type", "serialNumber", "assignedTo", "department", "location", "vendor"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    ConfigurationItem.find({ $or: ["ciId", "ciName", "type", "ipAddress", "owner", "vlan", "subnet"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    KnowledgeArticle.find({ $or: ["articleId", "title", "content", "category"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    Employee.find({ $or: ["employeeId", "name", "email", "department", "designation"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
    PurchaseOrder.find({ $or: ["poId", "vendor", "itemDescription"].map((f) => ({ [f]: rx })) }).limit(RESULT_CAP).lean(),
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

  return results.slice(0, RESULT_CAP);
}

module.exports = { globalSearch, RESULT_CAP };
