/*************************************************************
 * adminController.js — port of AdminEngine.gs.
 * Everything here is gated to Administrator only via
 * guard("admin_manage_users") / guard("admin_manage_settings") /
 * guard("admin_view_database") in adminRoutes.js — the Node
 * equivalent of the original's requireAdminOrITTeam() /
 * requirePermission("admin_view_database") in-function checks.
 *************************************************************/
const User = require("../models/User");
const Permission = require("../models/Permission");
const Incident = require("../models/Incident");
const ServiceRequest = require("../models/ServiceRequest");
const Problem = require("../models/Problem");
const Change = require("../models/Change");
const Asset = require("../models/Asset");
const { ROLE } = require("../config/constants");
const { ALL_ROLES_LIST, DEFAULT_PERMISSIONS_MAP } = require("../config/permissions");
const { clearPermissionsCache } = require("../utils/permissions");
const { logAudit } = require("../utils/auditLog");

/************************************************
 * USER MANAGEMENT
 * Port of getAllSystemUsersSafe() / createSystemUser() /
 * updateSystemUser(). The original's "Users sheet" (User ID |
 * Employee Name | Email | Department | Role | Status) is the
 * User collection here — same columns, same meaning.
 ************************************************/
async function listUsers(req, res) {
  const users = await User.find().sort({ name: 1 }).lean();
  res.render("admin/users", {
    users,
    ROLE,
    ALL_ROLES_LIST,
    message: req.query.message || null,
  });
}

function showNewUserForm(req, res) {
  res.render("admin/user-form", {
    ROLE,
    ALL_ROLES_LIST,
    editing: false,
    error: null,
    form: {},
  });
}

async function createUser(req, res) {
  try {
    const data = req.body;

    if (!data.name) throw new Error("Name is required.");
    if (!data.email) throw new Error("Email is required.");
    if (!data.role) throw new Error("Role is required.");
    if (!data.password) throw new Error("Password is required.");

    const existing = await User.findOne({ email: String(data.email).toLowerCase().trim() });
    if (existing) throw new Error("A user with that email already exists.");

    const user = new User({
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department || "",
      active: data.active === "on",
    });
    await user.setPassword(data.password);
    await user.save();

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "User",
      entityId: user._id,
      details: `Role: ${data.role}`,
    });

    res.redirect("/admin/users?message=User Added Successfully");
  } catch (err) {
    res.status(400).render("admin/user-form", {
      ROLE,
      ALL_ROLES_LIST,
      editing: false,
      error: err.message,
      form: req.body,
    });
  }
}

async function showEditUserForm(req, res) {
  const user = await User.findById(req.params.id).lean();
  if (!user) return res.status(404).render("errors/404");

  res.render("admin/user-form", {
    ROLE,
    ALL_ROLES_LIST,
    editing: true,
    error: null,
    form: user,
  });
}

async function updateUser(req, res) {
  try {
    const data = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).render("errors/404");

    if (!data.name) throw new Error("Name is required.");
    if (!data.email) throw new Error("Email is required.");
    if (!data.role) throw new Error("Role is required.");

    // Safety guard: an Administrator can never demote or deactivate the
    // very last active Administrator account — otherwise the Admin Console
    // (and User Management) locks everyone out with no way back in.
    const isDemotingOrDeactivating = user.role === ROLE.ADMIN && (data.role !== ROLE.ADMIN || data.active !== "on");
    if (isDemotingOrDeactivating) {
      const otherActiveAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        role: ROLE.ADMIN,
        active: true,
      });
      if (otherActiveAdmins === 0) {
        throw new Error("You can't remove the last active Administrator — this would lock everyone out.");
      }
    }

    user.name = data.name;
    user.email = data.email;
    user.role = data.role;
    user.department = data.department || "";
    user.active = data.active === "on";

    if (data.password) {
      await user.setPassword(data.password);
    }

    await user.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "User",
      entityId: user._id,
      details: `Role: ${data.role}, Status: ${user.active ? "Active" : "Inactive"}`,
    });

    res.redirect("/admin/users?message=User Updated Successfully");
  } catch (err) {
    res.status(400).render("admin/user-form", {
      ROLE,
      ALL_ROLES_LIST,
      editing: true,
      error: err.message,
      form: { ...req.body, _id: req.params.id },
    });
  }
}

/************************************************
 * PERMISSION MATRIX — reads/writes the Mongo-backed
 * Permission collection instead of a sheet, with the same
 * cache-clear-on-write behavior as the original togglePermission().
 ************************************************/
async function showPermissionMatrix(req, res) {
  const rows = await Permission.find().sort({ action: 1 }).lean();

  const matrix = rows.map((row) => ({
    action: row.action,
    allowedRoles: row.allowedRoles,
  }));

  res.render("admin/permissions", {
    matrix,
    ALL_ROLES_LIST,
    ROLE,
    message: req.query.message || null,
  });
}

async function updatePermissionMatrix(req, res) {
  try {
    const rows = await Permission.find();

    for (const row of rows) {
      const field = req.body[`roles_${row.action}`];
      let roles = [].concat(field || []).filter((r) => ALL_ROLES_LIST.includes(r));

      // Safety guard, ported verbatim from togglePermission(): Administrator
      // must always retain admin_manage_settings and admin_manage_users, no
      // matter what the submitted form said — this prevents locking every
      // Admin out of this very screen (and user management) with no way
      // back in except editing the database directly.
      if (
        (row.action === "admin_manage_settings" || row.action === "admin_manage_users") &&
        !roles.includes(ROLE.ADMIN)
      ) {
        roles.push(ROLE.ADMIN);
      }

      row.allowedRoles = roles;
      await row.save();
    }

    clearPermissionsCache();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Permissions",
      details: "Permission matrix updated.",
    });

    res.redirect("/admin/permissions?message=Permission matrix updated.");
  } catch (err) {
    res.status(400).send(err.message);
  }
}

/************************************************
 * SYSTEM SUMMARY — port of getSystemSummarySafe(), a quick
 * "is everything healthy" snapshot for the Admin Console
 * landing page. HR-suite counts (employees) will be added once
 * Phase 4 exists.
 ************************************************/
async function showSummary(req, res) {
  const [incidents, requests, problems, changes, assets, users] = await Promise.all([
    Incident.countDocuments(),
    ServiceRequest.countDocuments(),
    Problem.countDocuments(),
    Change.countDocuments(),
    Asset.countDocuments(),
    User.countDocuments(),
  ]);

  const permissionCount = Object.keys(DEFAULT_PERMISSIONS_MAP).length;

  res.render("admin/summary", {
    counts: { incidents, requests, problems, changes, assets, users, permissionCount },
  });
}

module.exports = {
  listUsers,
  showNewUserForm,
  createUser,
  showEditUserForm,
  updateUser,
  showPermissionMatrix,
  updatePermissionMatrix,
  showSummary,
};
