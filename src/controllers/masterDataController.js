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
const Holiday = require("../models/Holiday");
const { PRIORITY } = require("../config/constants");
const { logAudit } = require("../utils/auditLog");

// The Holiday model already existed (src/models/Holiday.js) and is
// already read by the SLA business-hours calculator and the Earned
// Leave accrual calc (see src/utils/sla.js / leaveBalances.js), but
// until now there was no controller, route, or view anywhere that
// could ever write to it — an Admin had no way to add a single
// company holiday, so both calculations silently behaved as if the
// company observed zero holidays, forever. Wiring it into the same
// generic Master Data CRUD as everything else fixes that with no new
// screen to build.
const HOLIDAY_FIELDS = [
  { name: "date", label: "Date", type: "date", required: true },
  { name: "description", label: "Description", type: "text", required: true },
];

// The three Department rows teamAccess.js matches on (case-insensitive)
// to gate HR/IT/Administration team access — see isHRTeam/isITTeam/
// isAdminTeam. Renaming or deleting one of these from Master Data would
// silently lock out (or open up) a whole team's access with no warning,
// so these three names are the one thing on this generic CRUD screen
// that isn't freely editable.
const PROTECTED_DEPARTMENT_NAMES = ["hr", "it", "administration"];

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
  holidays: {
    label: "Holidays",
    model: Holiday,
    fields: HOLIDAY_FIELDS,
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
    error: req.query.error || null,
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

    if (req.params.table === "departments" && PROTECTED_DEPARTMENT_NAMES.includes(String(row.name || "").trim().toLowerCase())) {
      const newName = String(req.body.name || "").trim().toLowerCase();
      if (newName !== String(row.name || "").trim().toLowerCase()) {
        throw new Error(
          `"${row.name}" can't be renamed — team access (HR/IT/Administration) is matched against this exact name. Add a new department instead.`
        );
      }
    }

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

  if (req.params.table === "departments") {
    const existing = await table.model.findById(req.params.id).lean();
    if (existing && PROTECTED_DEPARTMENT_NAMES.includes(String(existing.name || "").trim().toLowerCase())) {
      return res.redirect(
        `/masterdata/departments?error=${encodeURIComponent(`"${existing.name}" can't be deleted — team access (HR/IT/Administration) depends on it.`)}`
      );
    }
  }

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
