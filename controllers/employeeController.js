/*************************************************************
 * employeeController.js — port of EmployeeEngine.gs. This is the
 * shared employee directory other HR modules build on. Status
 * drives automation exactly like the original:
 *   - Status -> "New"  auto-creates onboarding Service Requests,
 *     the Onboarding checklist, and (on create only, matching the
 *     original's asymmetry between createEmployee and updateEmployee)
 *     the Admin Onboarding checklist, plus provisions a login.
 *   - Status -> "Left" auto-creates offboarding Service Requests
 *     (flagging any assets still assigned to them), the Offboarding
 *     checklist, and deactivates their login.
 * Create/update/import are HR-team gated (requireHRTeam); reading
 * the directory is open to any signed-in user, same as the original
 * (getAllEmployees() has no permission check at all there either).
 *************************************************************/
const Employee = require("../models/Employee");
const ServiceRequest = require("../models/ServiceRequest");
const Asset = require("../models/Asset");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { createChecklistIfMissing } = require("../utils/checklists");
const { CHECKLIST_TYPE } = require("../models/Checklist");
const { provisionUserAccess, deactivateUserAccess } = require("../utils/provisioning");

const ONBOARDING_REQUEST_TASKS = [
  "Provision Laptop/Workstation",
  "Create Email Account",
  "Issue Access Card / Building Access",
];

const OFFBOARDING_REQUEST_TASKS = [
  "Revoke System Access",
  "Deactivate Email Account",
  "Collect Access Card / Building Access",
];

/** Port of createOnboardingTasks() — pre-approved Service Requests, since onboarding is mandatory, not discretionary. */
async function createOnboardingServiceRequests(employee, actorId) {
  for (const task of ONBOARDING_REQUEST_TASKS) {
    const requestId = await generateSequentialId("REQ");
    await ServiceRequest.create({
      requestId,
      requester: employee.name,
      department: employee.department,
      catalogItem: task,
      details: `Auto-generated onboarding task for new joiner: ${employee.name}${employee.location ? ` (${employee.location})` : ""}`,
      approvalStatus: ServiceRequest.APPROVAL.APPROVED,
      createdBy: "system",
    });
  }
  await logAudit({ user: actorId, action: "Onboarding Tasks Created", entityType: "Employee", details: employee.name });
}

/** Port of createOffboardingTasks() — same idea, plus flags any assets still assigned to this person. */
async function createOffboardingServiceRequests(employee, actorId) {
  for (const task of OFFBOARDING_REQUEST_TASKS) {
    const requestId = await generateSequentialId("REQ");
    await ServiceRequest.create({
      requestId,
      requester: employee.name,
      department: employee.department,
      catalogItem: task,
      details: `Auto-generated offboarding task for departing employee: ${employee.name}`,
      approvalStatus: ServiceRequest.APPROVAL.APPROVED,
      createdBy: "system",
    });
  }

  const assignedAssets = await Asset.find({ assignedTo: new RegExp(`^${employee.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
  if (assignedAssets.length > 0) {
    const requestId = await generateSequentialId("REQ");
    await ServiceRequest.create({
      requestId,
      requester: employee.name,
      department: employee.department,
      catalogItem: "Collect Assets on Offboarding",
      details: `Assets still assigned to ${employee.name}: ${assignedAssets.map((a) => `${a.assetId} (${a.assetName})`).join(", ")}`,
      approvalStatus: ServiceRequest.APPROVAL.APPROVED,
      createdBy: "system",
    });
  }

  await logAudit({ user: actorId, action: "Offboarding Tasks Created", entityType: "Employee", details: employee.name });
}

async function listEmployees(req, res) {
  const { q, department, status } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["employeeId", "name", "email", "department", "designation"].map((f) => ({ [f]: rx }));
  }

  const employees = await Employee.find(filter).sort({ name: 1 }).lean();

  // One-time temp-credential notice from a just-completed provisioning —
  // see utils/provisioning.js for why this exists instead of an email.
  const tempCredential = req.session.tempCredential || null;
  delete req.session.tempCredential;

  res.render("employees/list", {
    employees,
    query: { q: q || "", department: department || "", status: status || "" },
    EMPLOYMENT_TYPE: Employee.EMPLOYMENT_TYPE,
    EMPLOYEE_STATUS: Employee.EMPLOYEE_STATUS,
    tempCredential,
    message: req.query.message || null,
  });
}

function showNewForm(req, res) {
  res.render("employees/form", {
    editing: false,
    error: null,
    form: {},
    EMPLOYMENT_TYPE: Employee.EMPLOYMENT_TYPE,
    EMPLOYEE_STATUS: Employee.EMPLOYEE_STATUS,
  });
}

async function createEmployee(req, res) {
  try {
    const data = req.body;
    if (!data.name) throw new Error("Name is required.");
    if (!data.email) throw new Error("Email is required.");
    if (!data.department) throw new Error("Department is required.");

    const employmentType = data.employmentType || Employee.EMPLOYMENT_TYPE.ON_ROLL;
    if (employmentType === Employee.EMPLOYMENT_TYPE.CONTRACT && !data.contractEndDate) {
      throw new Error("Contract End Date is required for Contract employees.");
    }

    const existing = await Employee.findOne({ email: String(data.email).toLowerCase().trim() });
    if (existing) throw new Error("An employee with that email already exists.");

    const employeeId = await generateSequentialId(Employee.PREFIX);
    const status = data.status || Employee.EMPLOYEE_STATUS.NEW;

    const employee = await Employee.create({
      employeeId,
      name: data.name,
      email: data.email,
      department: data.department,
      location: data.location || "",
      designation: data.designation || "",
      status,
      employmentType,
      contractEndDate: employmentType === Employee.EMPLOYMENT_TYPE.CONTRACT ? data.contractEndDate : undefined,
      reportsTo: data.reportsTo || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "Employee", entityId: employee._id, details: data.name });

    let tempPassword = null;
    if (status === Employee.EMPLOYEE_STATUS.NEW) {
      await createOnboardingServiceRequests(employee, req.user._id);
      await createChecklistIfMissing(CHECKLIST_TYPE.ONBOARDING, employee.name, employee.department, req.user._id);
      await createChecklistIfMissing(CHECKLIST_TYPE.ADMIN_ONBOARDING, employee.name, employee.department, req.user._id);
      tempPassword = await provisionUserAccess(employee, req.user._id);
    }

    if (tempPassword) {
      req.session.tempCredential = { name: employee.name, email: employee.email, password: tempPassword };
    }

    res.redirect("/employees?message=Employee Added Successfully");
  } catch (err) {
    res.status(400).render("employees/form", {
      editing: false,
      error: err.message,
      form: req.body,
      EMPLOYMENT_TYPE: Employee.EMPLOYMENT_TYPE,
      EMPLOYEE_STATUS: Employee.EMPLOYEE_STATUS,
    });
  }
}

async function showEmployee(req, res) {
  const employee = await Employee.findById(req.params.id).lean();
  if (!employee) return res.status(404).render("errors/404");
  res.render("employees/detail", { employee });
}

async function showEditForm(req, res) {
  const employee = await Employee.findById(req.params.id).lean();
  if (!employee) return res.status(404).render("errors/404");
  res.render("employees/form", {
    editing: true,
    error: null,
    form: employee,
    EMPLOYMENT_TYPE: Employee.EMPLOYMENT_TYPE,
    EMPLOYEE_STATUS: Employee.EMPLOYEE_STATUS,
  });
}

async function updateEmployee(req, res) {
  try {
    const data = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).render("errors/404");

    const previousStatus = employee.status;
    const employmentType = data.employmentType || Employee.EMPLOYMENT_TYPE.ON_ROLL;

    employee.name = data.name;
    employee.email = data.email;
    employee.department = data.department;
    employee.location = data.location || "";
    employee.designation = data.designation || "";
    employee.status = data.status;
    employee.employmentType = employmentType;
    employee.contractEndDate = employmentType === Employee.EMPLOYMENT_TYPE.CONTRACT ? data.contractEndDate || undefined : undefined;
    employee.reportsTo = data.reportsTo || "";

    await employee.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Employee",
      entityId: employee._id,
      details: `Status: ${employee.status}`,
    });

    let tempPassword = null;
    if (employee.status !== previousStatus) {
      if (employee.status === Employee.EMPLOYEE_STATUS.NEW) {
        await createOnboardingServiceRequests(employee, req.user._id);
        await createChecklistIfMissing(CHECKLIST_TYPE.ONBOARDING, employee.name, employee.department, req.user._id);
        tempPassword = await provisionUserAccess(employee, req.user._id);
      } else if (employee.status === Employee.EMPLOYEE_STATUS.LEFT) {
        await createOffboardingServiceRequests(employee, req.user._id);
        await createChecklistIfMissing(CHECKLIST_TYPE.OFFBOARDING, employee.name, employee.department, req.user._id);
        await deactivateUserAccess(employee, req.user._id);
      }
    }

    if (tempPassword) {
      req.session.tempCredential = { name: employee.name, email: employee.email, password: tempPassword };
    }

    res.redirect("/employees?message=Employee Updated Successfully");
  } catch (err) {
    res.status(400).render("employees/form", {
      editing: true,
      error: err.message,
      form: { ...req.body, _id: req.params.id },
      EMPLOYMENT_TYPE: Employee.EMPLOYMENT_TYPE,
      EMPLOYEE_STATUS: Employee.EMPLOYEE_STATUS,
    });
  }
}

module.exports = {
  listEmployees,
  showNewForm,
  createEmployee,
  showEmployee,
  showEditForm,
  updateEmployee,
  createOnboardingServiceRequests,
  createOffboardingServiceRequests,
};
