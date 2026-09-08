/*************************************************************
 * cmdbController.js — port of CMDBEngine.gs.
 *************************************************************/
const ConfigurationItem = require("../models/ConfigurationItem");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");
const { paginate } = require("../utils/pagination");

async function listCIs(req, res) {
  const { q, status, type } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["ciId", "ciName", "type", "ipAddress", "owner", "vlan", "subnet"].map((f) => ({ [f]: rx }));
  }

  const { rows: cis, pageInfo } = await paginate(ConfigurationItem, filter, { createdDate: -1 }, req.query);

  res.render("cmdb/list", {
    cis,
    query: { q: q || "", status: status || "", type: type || "" },
    pageInfo,
  });
}

function showNewForm(req, res) {
  res.render("cmdb/new", { error: null, form: {} });
}

async function createCI(req, res) {
  try {
    const data = req.body;
    for (const field of ["ciName", "type"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const ciId = await generateSequentialId("CI");

    const ci = await ConfigurationItem.create({
      ciId,
      ciName: data.ciName,
      type: data.type,
      ipAddress: data.ipAddress || "",
      owner: data.owner || "",
      status: data.status || "Active",
      dependencies: data.dependencies || "",
      vlan: data.vlan || "",
      subnet: data.subnet || "",
      createdBy: req.user.email,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "CMDB",
      entityId: ci._id,
      details: data.ciName,
    });

    res.redirect(`/cmdb/${ci._id}?created=1`);
  } catch (err) {
    res.status(400).render("cmdb/new", { error: err.message, form: req.body });
  }
}

async function showCI(req, res) {
  const ci = await ConfigurationItem.findById(req.params.id).lean();
  if (!ci) return res.status(404).render("errors/404");

  const [attachments, auditEntries, canUpload] = await Promise.all([
    getAttachmentsForRecord("cmdb", ci._id),
    getAuditTrailForRecord(ci._id),
    hasPermission(req.user.role, "cmdb_edit"),
  ]);

  res.render("cmdb/detail", {
    ci,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    moduleKey: "cmdb",
  });
}

async function updateCI(req, res) {
  try {
    const data = req.body;
    const ci = await ConfigurationItem.findById(req.params.id);
    if (!ci) return res.status(404).render("errors/404");

    ci.ciName = data.ciName;
    ci.type = data.type;
    ci.ipAddress = data.ipAddress || "";
    ci.owner = data.owner || "";
    ci.status = data.status || "Active";
    ci.dependencies = data.dependencies || "";
    ci.vlan = data.vlan || "";
    ci.subnet = data.subnet || "";

    await ci.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "CMDB",
      entityId: ci._id,
      details: data.ciName,
    });

    res.redirect(`/cmdb/${ci._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

async function deleteCI(req, res) {
  const ci = await ConfigurationItem.findByIdAndDelete(req.params.id);
  if (!ci) return res.status(404).render("errors/404");

  await logAudit({
    user: req.user._id,
    action: "Delete",
    entityType: "CMDB",
    entityId: ci._id,
  });

  res.redirect("/cmdb");
}

/************************************************
 * IMPACT ANALYSIS — Architecture Phase 5 (see
 * itsm_architecture_comparison.md): the Dependencies field has always
 * been a free-text, comma-separated list of CI IDs (same trade-off as
 * Problem.linkedIncidents — see ConfigurationItem.js's schema comment),
 * which is fine for RECORDING a relationship but useless for ANSWERING
 * "what breaks if this goes down", the actual point of a CMDB in every
 * commercial ITSM platform. This treats that same free-text field as a
 * real (if informally-typed) dependency graph and traverses it both
 * ways, with no schema change and no new collection.
 ************************************************/
const MAX_IMPACT_DEPTH = 3;

/** "CI-2026-000001, CI-2026-000003" -> ["CI-2026-000001", "CI-2026-000003"] */
function parseDependencyIds(dependencies) {
  return String(dependencies || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One pass over the whole CMDB, keyed by ciId, each node carrying its own parsed dependsOn list. */
async function buildCiGraph() {
  const cis = await ConfigurationItem.find().select("ciId ciName type status dependencies").lean();
  const byId = new Map();
  cis.forEach((ci) => {
    byId.set(ci.ciId, {
      ciId: ci.ciId,
      ciName: ci.ciName,
      type: ci.type,
      status: ci.status,
      dependsOn: parseDependencyIds(ci.dependencies),
    });
  });
  return byId;
}

/**
 * Breadth-first walk out from `startId` along whatever edges `edgeFn`
 * returns for a node, grouped by hop distance and capped at `maxDepth`.
 * Cycle-safe (a dependency loop just stops expanding, it never re-visits
 * a node) and tolerant of dangling references — a dependency string that
 * names a CI ID nothing in the CMDB actually has comes back tagged
 * `unknown: true` instead of throwing or silently vanishing, so a typo'd
 * or since-deleted CI ID is visible on the page rather than hidden.
 */
function traverse(byId, startId, edgeFn, maxDepth) {
  const levels = [];
  const visited = new Set([startId]);
  let frontier = [startId];

  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const nextFrontier = [];
    const levelNodes = [];
    for (const id of frontier) {
      const node = byId.get(id);
      const neighbors = node ? edgeFn(node) : [];
      for (const nId of neighbors) {
        if (visited.has(nId)) continue;
        visited.add(nId);
        nextFrontier.push(nId);
        const nNode = byId.get(nId);
        levelNodes.push(nNode ? { ciId: nNode.ciId, ciName: nNode.ciName, type: nNode.type, status: nNode.status } : { ciId: nId, unknown: true });
      }
    }
    if (levelNodes.length) levels.push({ depth, nodes: levelNodes });
    frontier = nextFrontier;
  }
  return levels;
}

async function showImpact(req, res) {
  const ci = await ConfigurationItem.findById(req.params.id).lean();
  if (!ci) return res.status(404).render("errors/404");

  const byId = await buildCiGraph();

  // Downstream — what THIS CI needs to function: follow each node's own
  // dependsOn list outward.
  const downstream = traverse(byId, ci.ciId, (node) => node.dependsOn, MAX_IMPACT_DEPTH);

  // Upstream — what BREAKS if this CI goes down: the reverse edge. The
  // CMDB never stores a reverse pointer, so this is found by scanning
  // every other node's dependsOn list for a match at each hop — fine at
  // the size a small company's CMDB actually reaches.
  const upstream = traverse(
    byId,
    ci.ciId,
    (node) => {
      const dependents = [];
      for (const other of byId.values()) {
        if (other.dependsOn.includes(node.ciId)) dependents.push(other.ciId);
      }
      return dependents;
    },
    MAX_IMPACT_DEPTH
  );

  res.render("cmdb/impact", { ci, downstream, upstream, moduleKey: "cmdb" });
}

module.exports = { listCIs, showNewForm, createCI, showCI, updateCI, deleteCI, showImpact };
