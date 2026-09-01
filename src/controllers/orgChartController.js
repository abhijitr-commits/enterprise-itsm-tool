/*************************************************************
 * orgChartController.js — port of OrgChartEngine.gs v2.0. Builds a
 * real person-to-person reporting tree from each employee's
 * "Reports To" field. Anyone without a manager set (or whose
 * manager left / has a typo) becomes a top-level root, so the chart
 * stays usable while the data is still being filled in.
 *************************************************************/
const Employee = require("../models/Employee");

function buildTree(employees) {
  const byName = {};
  employees.forEach((e) => {
    byName[e.name.trim().toLowerCase()] = e;
  });

  const roots = employees.filter((e) => {
    const managerKey = String(e.reportsTo || "").trim().toLowerCase();
    return !managerKey || !byName[managerKey];
  });

  function buildNode(employee) {
    const directReports = employees.filter(
      (e) => String(e.reportsTo || "").trim().toLowerCase() === employee.name.trim().toLowerCase()
    );
    return {
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
      reports: directReports.map(buildNode),
    };
  }

  return roots.map(buildNode);
}

async function showOrgChart(req, res) {
  const employees = await Employee.find({ status: { $ne: Employee.EMPLOYEE_STATUS.LEFT } }).lean();

  const tree = buildTree(employees);
  const hasHierarchyData = employees.some((e) => e.reportsTo);

  res.render("orgchart/index", { tree, hasHierarchyData });
}

module.exports = { showOrgChart };
