/*************************************************************
 * csvHelper.js — small, dependency-free CSV encode/decode + value
 * coercion used by the generic export/import engine (csvController.js).
 * No third-party CSV package is added on purpose — this keeps the
 * "free tools only" footprint unchanged and avoids a new dependency for
 * ~40 lines of well-understood RFC4180 handling.
 *************************************************************/

/** Escape one value for a CSV cell (RFC4180: quote if it contains a
 * comma, quote, or newline; double up any embedded quotes). */
function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Format a JS value for CSV output, per the column's declared type. */
function formatCell(value, column) {
  if (value === null || value === undefined) return "";
  if (column.type === "date") {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10); // YYYY-MM-DD — readable, re-importable
  }
  if (column.type === "boolean") return value ? "true" : "false";
  if (column.type === "stringlist") return Array.isArray(value) ? value.join(";") : String(value);
  return String(value);
}

/** Build a full CSV document (header + rows) from an array of plain
 * objects (as returned by .lean()) and a column spec [{key, type}]. */
function rowsToCSV(items, columns) {
  const header = columns.map((c) => csvEscape(c.key)).join(",");
  const lines = items.map((item) =>
    columns.map((c) => csvEscape(formatCell(getNested(item, c.key), c))).join(",")
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

/** Read a dotted path ("clearances.it") off a plain object. */
function getNested(obj, dottedKey) {
  return dottedKey.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

/** Write a dotted path ("clearances.it") into a plain object, building
 * intermediate objects as needed — the counterpart to getNested(), used
 * so import can hand Model.create() a properly nested doc instead of a
 * literal "clearances.it" top-level key (which Mongoose would not
 * interpret as a nested path). */
function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** RFC4180 parse: text -> array of rows, each an array of raw string
 * cells. Handles quoted fields, embedded commas/newlines, and doubled
 * quotes; tolerates both \r\n and \n line endings. */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  // Normalize so a bare \r never causes a duplicate row break.
  const s = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n") {
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  // last cell/row (files not always ending in a newline)
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  // drop wholly-blank trailing rows (trailing newline artifacts)
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Parse a CSV document into an array of {header: rawString} objects,
 * using the first row as the header. Unknown/extra columns in the file
 * are kept (caller decides what to do with them); missing columns are
 * simply absent from the resulting object. */
function csvTextToRecords(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec = {};
    headers.forEach((h, idx) => { rec[h] = r[idx] !== undefined ? r[idx] : ""; });
    return rec;
  });
}

/** Coerce one raw CSV string into the JS value a column's type expects.
 * Returns { ok, value, error }. Blank cells coerce to undefined (field
 * simply not set), except a required column, which is an error. */
function coerceCell(raw, column) {
  const trimmed = typeof raw === "string" ? raw.trim() : raw;
  if (trimmed === "" || trimmed === undefined || trimmed === null) {
    if (column.required) return { ok: false, error: `"${column.key}" is required` };
    return { ok: true, value: undefined };
  }
  if (column.enum && !column.enum.includes(trimmed)) {
    return { ok: false, error: `"${column.key}" must be one of: ${column.enum.join(", ")} (got "${trimmed}")` };
  }
  if (column.type === "number") {
    const n = Number(trimmed);
    if (isNaN(n)) return { ok: false, error: `"${column.key}" must be a number (got "${trimmed}")` };
    return { ok: true, value: n };
  }
  if (column.type === "date") {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return { ok: false, error: `"${column.key}" must be a valid date (got "${trimmed}")` };
    return { ok: true, value: d };
  }
  if (column.type === "boolean") {
    return { ok: true, value: /^(true|yes|1)$/i.test(trimmed) };
  }
  if (column.type === "stringlist") {
    return { ok: true, value: trimmed.split(";").map((s) => s.trim()).filter(Boolean) };
  }
  return { ok: true, value: trimmed };
}

module.exports = { csvEscape, formatCell, rowsToCSV, parseCSV, csvTextToRecords, coerceCell, getNested, setNested };
