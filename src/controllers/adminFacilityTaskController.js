/*************************************************************
 * adminFacilityTaskController.js — Administration-department Facility
 * Ops task log (cleaning rounds, pantry restocking, servicing
 * checks). Simple Pending → Completed/Skipped lifecycle, same
 * inline-action badge pattern as adminScrapController.js.
 *************************************************************/
const AdminFacilityTask = require("../models/AdminFacilityTask");
const { FACILITY_TASK_FREQUENCY, FACILITY_TASK_STATUS } = AdminFacilityTask;
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { paginate } = require("../utils/pagination");

async function listTasks(req, res) {
  const { rows: tasks, pageInfo } = await paginate(AdminFacilityTask, {}, { scheduledDate: 1 }, req.query);
  res.render("admin-facility/list", { tasks, FACILITY_TASK_FREQUENCY, message: req.query.message || null, pageInfo });
}

function showNewForm(req, res) {
  res.render("admin-facility/new", { error: null, form: {}, FACILITY_TASK_FREQUENCY });
}

async function createTask(req, res) {
  try {
    const data = req.body;
    if (!data.taskName) throw new Error("Task Name is required.");
    if (!data.area) throw new Error("Area is required.");

    const taskId = await generateSequentialId("ADTASK");
    await AdminFacilityTask.create({
      taskId,
      taskName: data.taskName,
      area: data.area,
      assignedStaff: data.assignedStaff || "",
      frequency: data.frequency || FACILITY_TASK_FREQUENCY.DAILY,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : new Date(),
      remarks: data.remarks || "",
      raisedBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create", entityType: "AdminFacilityTask", details: data.taskName });

    res.redirect(`/admin/facility-tasks?message=${encodeURIComponent("Task Added Successfully")}`);
  } catch (err) {
    res.status(400).render("admin-facility/new", { error: err.message, form: req.body, FACILITY_TASK_FREQUENCY });
  }
}

async function markComplete(req, res) {
  try {
    const task = await AdminFacilityTask.findOne({ taskId: req.params.taskId });
    if (!task) return res.status(404).render("errors/404");
    if (task.status !== FACILITY_TASK_STATUS.PENDING) throw new Error("Only a Pending task can be marked complete.");

    task.status = FACILITY_TASK_STATUS.COMPLETED;
    task.completedDate = new Date();
    if (req.body.remarks) task.remarks = req.body.remarks;
    await task.save();

    await logAudit({ user: req.user._id, action: "Complete", entityType: "AdminFacilityTask", entityId: task._id, details: task.taskName });

    res.redirect(`/admin/facility-tasks?message=${encodeURIComponent(`${task.taskId} marked completed.`)}`);
  } catch (err) {
    res.redirect(`/admin/facility-tasks?message=${encodeURIComponent(err.message)}`);
  }
}

async function markSkipped(req, res) {
  try {
    const task = await AdminFacilityTask.findOne({ taskId: req.params.taskId });
    if (!task) return res.status(404).render("errors/404");
    if (task.status !== FACILITY_TASK_STATUS.PENDING) throw new Error("Only a Pending task can be marked skipped.");

    task.status = FACILITY_TASK_STATUS.SKIPPED;
    if (req.body.remarks) task.remarks = req.body.remarks;
    await task.save();

    await logAudit({ user: req.user._id, action: "Skip", entityType: "AdminFacilityTask", entityId: task._id, details: task.taskName });

    res.redirect(`/admin/facility-tasks?message=${encodeURIComponent(`${task.taskId} marked skipped.`)}`);
  } catch (err) {
    res.redirect(`/admin/facility-tasks?message=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { listTasks, showNewForm, createTask, markComplete, markSkipped };
