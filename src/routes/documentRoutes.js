const express = require("express");
const router = express.Router();
const employeeDocumentController = require("../controllers/employeeDocumentController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

// Ownership (self-or-HR-team) is checked inside the controller, same
// pattern as Goals/Reviews/Letters — no router-level guard here.
router.get("/", employeeDocumentController.showMyDocuments);
router.get("/:employeeName", employeeDocumentController.showEmployeeDocuments);
router.post("/upload", employeeDocumentController.uploadDocument);
router.get("/file/:documentId", employeeDocumentController.downloadDocument);

module.exports = router;
