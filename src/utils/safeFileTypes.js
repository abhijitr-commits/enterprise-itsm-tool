/*************************************************************
 * safeFileTypes.js — the shared upload/download allowlist used by
 * every file-storage module in this app (Attachments, Employee
 * Documents). Enforced at BOTH ends: rejected outright at upload, and
 * used again at download time to pick the Content-Type the server
 * serves the file back as — the client's self-reported mimetype is
 * never trusted for that, since a browser will happily render an
 * uploaded ".html"/".svg" with a script tag inside it if the server
 * ever echoes back an attacker-chosen Content-Type (stored XSS).
 * Deliberately excludes html/htm/svg/xml/js and anything else not on
 * this list, even if some module might plausibly want it later —
 * safer to extend this on request than to guess wide now.
 *************************************************************/
const SAFE_ATTACHMENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

// Only these render safely inline in a browser tab; everything else on
// the allowlist above downloads instead (a .docx can't execute anything
// just by being fetched, but there's no reason to try to render it inline
// either).
const INLINE_RENDERABLE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif"]);

const ALLOWED_TYPES_MESSAGE =
  "That file type isn't allowed. Supported types: PDF, Word, Excel, PowerPoint, images (PNG/JPG/GIF), TXT, CSV, ZIP.";

function extensionOf(fileName) {
  const match = /\.[^./\\]+$/.exec(String(fileName || ""));
  return match ? match[0].toLowerCase() : "";
}

function isAllowedFileName(fileName) {
  return Boolean(SAFE_ATTACHMENT_TYPES[extensionOf(fileName)]);
}

/** The Content-Type + Content-Disposition this app should serve a stored file back as, derived only from its own filename — never from a client-supplied mimetype. */
function safeServingHeaders(fileName) {
  const ext = extensionOf(fileName);
  const contentType = SAFE_ATTACHMENT_TYPES[ext] || "application/octet-stream";
  const disposition = INLINE_RENDERABLE_EXTENSIONS.has(ext) ? "inline" : "attachment";
  const safeFileName = String(fileName || "download").replace(/["\r\n]/g, "");
  return { contentType, disposition, safeFileName };
}

module.exports = { extensionOf, isAllowedFileName, safeServingHeaders, ALLOWED_TYPES_MESSAGE };
