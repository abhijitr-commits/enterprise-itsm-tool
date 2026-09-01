/*************************************************************
 * masterDataController.js — port of MasterDataEngine.gs.
 * The original drove one generic CRUD screen off a config object
 * (MASTER_DATA_SHEETS) mapping a table key to a sheet name and its
 * column headers; this does the same thing but each "table" is a
 * Mongoose model instead of a sheet, with a small per-table field
 * list replacing "columns".
 *
 * Roles are NOT included here — in the original, "Roles" was a
 * lookup sheet of role names/descriptions, but here the role list
 * is a fixed enum (config/constants.js ROLE) tied directly into
 * the permission system, so there is nothing free-form to CRUD;
 * changing it would require a code change, matching how ROLE is a
 * real enum in every model already.
 *************************************************************/
const Department = require("../models/Department");
const Location = require("../models/Location");
const Category = require("../models/Category");
const SLAMatrix = require("../models/SLAMatrix");
const { PRIORITY } = require("../config/constants");
const { logAudit } = require("../utils/auditLog");

const MASTER_DATA_TABLES = {
  departments: {
    label: "Departments",
    model: Department,
    fields: [
      { name: "name", label: "Department Name", type: "text", required: true },
      { name: "head", label: "Head", type: "text" },
      { name: "location", label: "Location", type: "text" },
    ],
  },
  locations: {
    label: "Locations",
    model: Location,
    fields: [
      { name: "name", label: "Location Name", type: "text", required: true },
      { name: "address", label: "Address", type: "text" },
    ],
  },
  categories: {
    label: "Categories",
    model: Category,
    fields: [
      { name: "name", label: "Category Name", type: "text", required: true },
      {
        name: "module",
        label: "Module",
        type: "select",
        required: true,
        options: ["Incident", "Request", "Problem", "Change", "Asset"],
      },
      { name: "subCategory", label: "Sub-Category", type: "text" },
    ],
  },
  slamatrix: {
    label: "SLA Matrix",
    model: SLAMatrix,
    fields: [
      {
        name: "module",
        label: "Module",
        type: "select",
        required: true,
        options: ["Incident", "Request", "Problem", "Change"],
      },
      { name: "priority", label: "Priority", type: "select", required: true, options: Object.values(PRIORITY) },
      { name: "responseTimeHours", label: "Response SLA (Hours)", type: "number", required: true },
      { name: "resolutionTimeHours", label: "Resolution SLA (Hours)", type: "number", required: true },
    ],
  },
};

function getTableOr404(req, res) {
  const table = MASTER_DATA_TABLES[req.params.table];
  if (!table) {
    res.status(404).render("errors/404");
    return null;
  }
  return table;
}

function tableNav() {
  return Object.keys(MASTER_DATA_TABLES).map((key) => ({ key, label: MASTER_DATA_TABLES[key].label }));
}

async function listRows(req, res) {
  const table = getTableOr404(req, res);
  if (!table) return;

  const rows = await table.model.find().sort({ _id: -1 }).lean();

  res.render("masterdata/list", {
    tableKey: req.params.table,
    table,
    rows,
    tables: tableNav(),
    message: req.query.message || null,
  });
}

function showNewForm(req, res) {
  const table = getTableOr404(req, res);
  if (!table) return;

  res.render("masterdata/form", {
    tableKey: req.params.table,
    table,
    tables: tableNav(),
    editing: false,
    error: null,
    form: {},
  });
}

async function createRow(req, res) {
  const table = getTableOr404(req, res);
  if (!table) return;

  try {
    const doc = {};
    for (const field of table.fields) {
      if (field.required && !req.body[field.name]) {
        throw new Error(`${field.label} is required.`);
      }
      doc[field.name] = req.body[field.name] || undefined;
    }

    await table.model.create(doc);

    await logAudit({
      user: req.user._id,
      action: "Add Row",
      entityType: "Master Data",
      details: `${table.label}: ${JSON.stringify(doc)}`,
    });

    res.redirect(`/masterdata/${req.params.table}?message=Added successfully.`);
  } catch (err) {
    res.status(400).render("masterdata/form", {
      tableKey: req.params.table,
      table,
      tables: tableNav(),
      editing: false,
      error: err.message,
      form: req.body,
    });
  }
}

async function showEditForm(req, res) {
  const table = getTableOr404(req, res);
  if (!table) return;

  const row = await table.model.findById(req.params.id).lean();
  if (!row) return res.status(404).render("errors/404");

  res.render("masterdata/form", {
    tableKey: req.params.table,
    table,
    tables: tableNav(),
    editing: true,
    error: null,
    form: row,
  });
}

async function updateRow(req, res) {
  const table = getTableOr404(req, res);
  if (!table) return;

  try {
    const row = await table.model.findById(req.params.id);
    if (!row) return res.status(404).render("errors/404");

    for (const field of table.fields) {
      if (field.required && !req.body[field.name]) {
        throw new Error(`${field.label} is required.`);
      }
      row[field.name] = req.body[field.name] || undefined;
    }

    await row.save();

    await logAudit({
      user: req.user._id,
      action: "Update Row",
      entityType: "Master Data",
      entityId: row._id,
      details: table.label,
    });

    res.redirect(`/masterdata/${req.params.table}?message=Updated successfully.`);
  } catch (err) {
    res.status(400).render("masterdata/form", {
      tableKey: req.params.table,
      table,
      tables: tableNav(),
      editing: true,
      error: err.message,
      form: { ...req.body, _id: req.params.id },
    });
  }
}

async function deleteRow(req, res) {
  const table = getTableOr404(req, res);
  if (!table) return;

  const row = await table.model.findByIdAndDelete(req.params.id);

  await logAudit({
    user: req.user._id,
    action: "Delete Row",
    entityType: "Master Data",
    entityId: row ? row._id : undefined,
    details: table.label,
  });

  res.redirect(`/masterdata/${req.params.table}?message=Deleted successfully.`);
}

module.exports = {
  MASTER_DATA_TABLES,
  listRows,
  showNewForm,
  createRow,
  showEditForm,
  updateRow,
  deleteRow,
};
