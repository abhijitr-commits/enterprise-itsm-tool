/*************************************************************
 * cmdbController.js — port of CMDBEngine.gs.
 *************************************************************/
const ConfigurationItem = require("../models/ConfigurationItem");
const CIRelationship = require("../models/CIRelationship");
const { RELATIONSHIP_TYPES } = require("../models/CIRelationship");
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

  const [attachments, auditEntries, canUpload, outgoing, incoming, otherCIs] = await Promise.all([
    getAttachmentsForRecord("cmdb", ci._id),
    getAuditTrailForRecord(ci._id),
    hasPermission(req.user.role, "cmdb_edit"),
    CIRelationship.find({ source: ci._id }).populate("target", "ciId ciName type status").sort({ createdDate: -1 }).lean(),
    CIRelationship.find({ target: ci._id }).populate("source", "ciId ciName type status").sort({ createdDate: -1 }).lean(),
    ConfigurationItem.find({ _id: { $ne: ci._id } }).select("ciId ciName type").sort({ ciId: 1 }).lean(),
  ]);

  res.render("cmdb/detail", {
    ci,
    justCreated: req.query.created === "1",
    attachments,
    auditEntries,
    canUpload,
    moduleKey: "cmdb",
    outgoing,
    incoming,
    otherCIs,
    relationshipTypes: RELATIONSHIP_TYPES,
    relError: null,
  });
}

/**
 * Adds one typed, directed relationship from this CI to another. Both
 * "how do these relate" (type) and an optional free-text note. A CI can't
 * be related to itself, and the same (source, target, type) triple can't
 * be added twice — everything else is left wide open, same philosophy as
 * the rest of the CMDB (owner/type/etc are free text, not locked lists).
 */
async function addRelationship(req, res) {
  const ci = await ConfigurationItem.findById(req.params.id).lean();
  if (!ci) return res.status(404).render("errors/404");

  const rerender = async (message) => {
    const [attachments, auditEntries, canUpload, outgoing, incoming, otherCIs] = await Promise.all([
      getAttachmentsForRecord("cmdb", ci._id),
      getAuditTrailForRecord(ci._id),
      hasPermission(req.user.role, "cmdb_edit"),
      CIRelationship.find({ source: ci._id }).populate("target", "ciId ciName type status").sort({ createdDate: -1 }).lean(),
      CIRelationship.find({ target: ci._id }).populate("source", "ciId ciName type status").sort({ createdDate: -1 }).lean(),
      ConfigurationItem.find({ _id: { $ne: ci._id } }).select("ciId ciName type").sort({ ciId: 1 }).lean(),
    ]);
    return res.status(400).render("cmdb/detail", {
      ci,
      justCreated: false,
      attachments,
      auditEntries,
      canUpload,
      moduleKey: "cmdb",
      outgoing,
      incoming,
      otherCIs,
      relationshipTypes: RELATIONSHIP_TYPES,
      relError: message,
    });
  };

  const { targetId, type, notes } = req.body;
  if (!targetId) return rerender("Choose a target CI.");
  if (targetId === String(ci._id)) return rerender("A CI can't be related to itself.");
  if (!RELATIONSHIP_TYPES.includes(type)) return rerender("Choose a valid relationship type.");

  const target = await ConfigurationItem.findById(targetId).lean();
  if (!target) return rerender("That target CI no longer exists.");

  const duplicate = await CIRelationship.findOne({ source: ci._id, target: targetId, type });
  if (duplicate) return rerender(`${ci.ciId} already has a "${type}" relationship to ${target.ciId}.`);

  const rel = await CIRelationship.create({
    source: ci._id,
    target: targetId,
    type,
    notes: notes || "",
    createdBy: req.user.email,
  });

  await logAudit({
    user: req.user._id,
    action: "Add Relationship",
    entityType: "CMDB",
    entityId: ci._id,
    details: `${ci.ciId} —${type}→ ${target.ciId}`,
  });
  await logAudit({
    user: req.user._id,
    action: "Add Relationship",
    entityType: "CMDB",
    entityId: target._id,
    details: `${ci.ciId} —${type}→ ${target.ciId}`,
  });

  res.redirect(`/cmdb/${ci._id}#relationships`);
}

async function deleteRelationship(req, res) {
  const rel = await CIRelationship.findByIdAndDelete(req.params.relId);
  if (rel) {
    await logAudit({
      user: req.user._id,
      action: "Delete Relationship",
      entityType: "CMDB",
      entityId: rel.source,
      details: `Removed "${rel.type}" relationship`,
    });
  }
  const backTo = rel ? rel.source : req.body.returnTo;
  res.redirect(`/cmdb/${backTo}#relationships`);
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
 * commercial ITSM platform. This originally treated that free-text field
 * as a real (if informally-typed) dependency graph, with no schema
 * change and no new collection.
 *
 * Task #101 (audit backlog) adds actual typed relationships on top,
 * additively — see CIRelationship.js. buildCiGraph() below now merges
 * both sources into one graph; the legacy free-text edges keep working
 * exactly as before (still traversed, just labeled "Related (legacy)").
 ************************************************/
const MAX_IMPACT_DEPTH = 3;

/** "CI-2026-000001, CI-2026-000003" -> ["CI-2026-000001", "CI-2026-000003"] */
function parseDependencyIds(dependencies) {
  return String(dependencies || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * One pass over the whole CMDB, keyed by ciId, each node carrying its own
 * parsed dependsOn list. Task #101 adds `dependsOnTyped` — the same
 * outward edges, but sourced from the typed CIRelationship collection
 * (source: this CI) and labeled with their real relationship type,
 * merged alongside the legacy free-text edges (which stay labeled
 * "Related (legacy)" since the plain-text field never recorded a type).
 * Nothing here changes what the legacy `dependencies` field does —
 * typed relationships are additive, read from a separate collection.
 */
async function buildCiGraph() {
  const [cis, relationships] = await Promise.all([
    ConfigurationItem.find().select("ciId ciName type status dependencies").lean(),
    CIRelationship.find().populate("source", "ciId").populate("target", "ciId").lean(),
  ]);

  const byId = new Map();
  cis.forEach((ci) => {
    byId.set(ci.ciId, {
      ciId: ci.ciId,
      ciName: ci.ciName,
      type: ci.type,
      status: ci.status,
      dependsOn: parseDependencyIds(ci.dependencies).map((id) => ({ ciId: id, type: "Related (legacy)" })),
    });
  });

  relationships.forEach((rel) => {
    if (!rel.source || !rel.target) return; // dangling ref (target CI deleted) — skip rather than crash
    const node = byId.get(rel.source.ciId);
    if (node) node.dependsOn.push({ ciId: rel.target.ciId, type: rel.type });
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
      const edges = node ? edgeFn(node) : [];
      for (const edge of edges) {
        if (visited.has(edge.ciId)) continue;
        visited.add(edge.ciId);
        nextFrontier.push(edge.ciId);
        const nNode = byId.get(edge.ciId);
        levelNodes.push(
          nNode
            ? { ciId: nNode.ciId, ciName: nNode.ciName, type: nNode.type, status: nNode.status, relType: edge.type }
            : { ciId: edge.ciId, unknown: true, relType: edge.type }
        );
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
  // dependsOn list outward (now a mix of typed CIRelationship edges and
  // legacy free-text edges — see buildCiGraph).
  const downstream = traverse(byId, ci.ciId, (node) => node.dependsOn, MAX_IMPACT_DEPTH);

  // Upstream — what BREAKS if this CI goes down: the reverse edge. Typed
  // relationships are directional by design (source depends on target),
  // so "what depends on me" still has to be found by scanning every other
  // node's outward edges for one pointing at this node — fine at the size
  // a small company's CMDB actually reaches.
  const upstream = traverse(
    byId,
    ci.ciId,
    (node) => {
      const dependents = [];
      for (const other of byId.values()) {
        other.dependsOn.forEach((edge) => {
          if (edge.ciId === node.ciId) dependents.push({ ciId: other.ciId, type: edge.type });
        });
      }
      return dependents;
    },
    MAX_IMPACT_DEPTH
  );

  res.render("cmdb/impact", { ci, downstream, upstream, moduleKey: "cmdb" });
}

/**
 * Whole-CMDB graph view (task #101) — every CI as a node, every typed
 * relationship (plus legacy free-text dependency) as a directed edge,
 * laid out on a plain circle and rendered as one inline SVG. No charting
 * library: this app draws its own donut charts elsewhere the same way
 * (see the Reports module), so a self-contained SVG keeps that pattern
 * and needs nothing new installed. Deliberately whole-CMDB rather than
 * per-CI — the per-CI neighborhood view is what Impact Analysis already
 * is; this is the "see the whole map" complement to it.
 */
async function showGraph(req, res) {
  const byId = await buildCiGraph();
  const nodes = Array.from(byId.values());

  const width = 900;
  const height = 700;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(120, Math.min(320, 60 + nodes.length * 14));

  const positioned = nodes.map((node, i) => {
    const angle = nodes.length > 0 ? (2 * Math.PI * i) / nodes.length - Math.PI / 2 : 0;
    return {
      ...node,
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
    };
  });
  const posById = new Map(positioned.map((n) => [n.ciId, n]));

  const edges = [];
  positioned.forEach((node) => {
    node.dependsOn.forEach((edge) => {
      const target = posById.get(edge.ciId);
      if (target) edges.push({ from: node, to: target, type: edge.type });
    });
  });

  res.render("cmdb/graph", {
    moduleKey: "cmdb",
    width,
    height,
    nodes: positioned,
    edges,
    relationshipTypes: RELATIONSHIP_TYPES,
    isEmpty: nodes.length === 0,
  });
}

module.exports = {
  listCIs,
  showNewForm,
  createCI,
  showCI,
  updateCI,
  deleteCI,
  showImpact,
  addRelationship,
  deleteRelationship,
  showGraph,
};
