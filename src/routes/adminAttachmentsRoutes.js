/*************************************************************
 * adminAttachmentsRoutes.js — one route, hosting the generic
 * "record attachments" page (adminAttachmentsController.js) for all 7
 * Admin-team modules built this session. Actual upload/download still
 * goes through the existing /attachments routes (attachmentRoutes.js);
 * this route only renders the page a "📎 Files" link on each module's
 * list.ejs points to.
 *************************************************************/
const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/auth");
const { showAttachments } = require("../controllers/adminAttachmentsController");

router.use(requireLogin);
router.get("/:moduleKey/:recordId", showAttachments);

module.exports = router;
