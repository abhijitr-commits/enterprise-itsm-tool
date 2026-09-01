/*************************************************************
 * cmdbController.js — port of CMDBEngine.gs.
 *************************************************************/
const ConfigurationItem = require("../models/ConfigurationItem");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");
const { getAttachmentsForRecord, getAuditTrailForRecord } = require("../utils/recordExtras");

async function listCIs(req, res) {
  const { q, status, type } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["ciId", "ciName", "type", "ipAddress", "owner", "vlan", "subnet"].map((f) => ({ [f]: rx }));
  }

  const cis = await ConfigurationItem.find(filter).sort({ createdDate: -1 }).lean();

  res.render("cmdb/list", {
    cis,
    query: { q: q || "", status: status || "", type: type || "" },
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

module.exports = { listCIs, showNewForm, createCI, showCI, updateCI, deleteCI };
