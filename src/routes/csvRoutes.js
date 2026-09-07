/*************************************************************
 * csvRoutes.js — one export + one import route, shared by every module
 * in utils/csvRegistry.js. Mounted at /csv in server.js. Permission is
 * enforced inside csvController.js itself (per-module, from the
 * registry), not here — requireLogin is the only blanket gate, matching
 * the "reads aren't gated, writes are" convention used everywhere else
 * (export here is a read of already-visible data; import is a write).
 *************************************************************/
const express = require("express");
const router = express.Router();
const multer = require("multer");
const csvController = require("../controllers/csvController");
const { requireLogin } = require("../middleware/auth");

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB — generous for a spreadsheet export, small enough for the shared free-tier Atlas instance
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CSV_BYTES } }).single("file");

router.use(requireLogin);

// The central "Data Import/Export" hub page — GET /csv. Placed ahead of
// the :moduleKey routes for readability; there's no actual overlap since
// this is a zero-segment path and those need a moduleKey segment.
router.get("/", csvController.showHub);

router.get("/:moduleKey/export.csv", csvController.exportModule);

router.post("/:moduleKey/import", (req, res, next) => {
  upload(req, res, (uploadErr) => {
    if (uploadErr) {
      const redirectTarget = req.get("Referer") || "/";
      const message =
        uploadErr.code === "LIMIT_FILE_SIZE"
          ? `File is too large (max ${MAX_CSV_BYTES / (1024 * 1024)}MB).`
          : `Upload failed: ${uploadErr.message}`;
      return res.redirect(`${redirectTarget}${redirectTarget.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}`);
    }
    next();
  });
}, csvController.importModule);

module.exports = router;
