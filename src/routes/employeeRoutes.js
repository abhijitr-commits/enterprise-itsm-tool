const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const { requireLogin } = require("../middleware/auth");
const { requireHRTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Directory reads are open to any signed-in user, matching the original
// (getAllEmployees() has no permission check at all there either) — a
// company directory lookup is a normal thing for anyone to do.
router.get("/", employeeController.listEmployees);

// Writes are HR-team only (Administrator, or Manager + Department="HR").
// Specific routes ("/new") must come before "/:id" so "new" isn't parsed
// as an employee ID.
router.get("/new", requireHRTeam, employeeController.showNewForm);
router.post("/", requireHRTeam, employeeController.createEmployee);
router.get("/:id/edit", requireHRTeam, employeeController.showEditForm);
router.post("/:id", requireHRTeam, employeeController.updateEmployee);
router.get("/:id", employeeController.showEmployee);

module.exports = router;
