const express = require("express");
const router = express.Router();
const attachmentController = require("../controllers/attachmentController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

// Real enforcement (per-module edit permission) happens inside
// uploadAttachment() itself, same as employeeDocumentController.js's
// ownership check — the module key and record ID both need to be
// resolved first to know which permission action applies.
router.post("/:module/:recordId", attachmentController.uploadAttachment);
router.get("/:attachmentId/download", attachmentController.downloadAttachment);

module.exports = router;
