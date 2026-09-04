// Small, hand-authored set of clean outline icons (24x24 viewBox,
// stroke=currentColor, fill=none, rounded caps/joins) used in place of
// emoji across the UI, for a coherent, professional icon language.
//
// Centralized here + exposed as res.locals.icon (see src/middleware/auth.js's
// attachUser) so any view can render one with `<%- icon('home') %>` — no
// per-view SVG markup to keep in sync, and swapping/adding an icon later
// is a one-line change in this file.

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v10h5v-6h2v6h5V10"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3.2 2.6-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 20c0-2.5 1.7-4.4 3.8-5"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="1.6"/><path d="M8 20.5h8M12 16.5v4"/>',
  factory:
    '<path d="M4 21V11l5 3.5V11l5 3.5V9l6 4v8H4Z"/><path d="M9 21v-4M14 21v-4"/>',
  settings:
    '<circle cx="12" cy="12" r="3.1"/><path d="M12 3v2.4M12 18.6V21M4.6 6.3l1.7 1.6M17.7 16.1l1.7 1.6M3 12h2.4M18.6 12H21M4.6 17.7l1.7-1.6M17.7 7.9l1.7-1.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  "log-out":
    '<path d="M9.5 21H5.6a1.6 1.6 0 0 1-1.6-1.6V4.6A1.6 1.6 0 0 1 5.6 3H9.5"/><path d="m15.5 16.5 4.5-4.5-4.5-4.5"/><path d="M20 12H9"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 6 6 6-6 6"/>',
  "alert-circle":
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v6"/><circle cx="12" cy="16.7" r="0.75" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3.6 2.1"/>',
  "alert-triangle":
    '<path d="M12 3.3 22 20.5H2L12 3.3Z" stroke-linejoin="round"/><path d="M12 10v4"/><circle cx="12" cy="17.2" r="0.75" fill="currentColor" stroke="none"/>',
  "check-circle":
    '<circle cx="12" cy="12" r="9"/><path d="m7.8 12.5 2.6 2.6 5.8-5.8"/>',
  "clipboard-check":
    '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="m9 13.2 2 2 4-4.4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z" stroke-linejoin="round"/><path d="m3 13 9 5 9-5" /><path d="m3 8.5 9 5 9-5"/>',
  briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M2.5 12.5h19"/>',
  shield: '<path d="M12 2.5 20 6v6c0 5-3.4 8-8 9.5C7.4 20 4 17 4 12V6l8-3.5Z" stroke-linejoin="round"/>',
  heart: '<path d="M12 20.5S3.5 15.4 3.5 9.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8.5 1.7c0 6.1-8.5 11.2-8.5 11.2Z" stroke-linejoin="round"/>',
  truck: '<rect x="1.5" y="7" width="13" height="10" rx="1.4"/><path d="M14.5 10.5H18l3.5 3.5V17h-7z"/><circle cx="6" cy="19" r="1.7"/><circle cx="17.5" cy="19" r="1.7"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.3"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.3"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.3"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
};

/**
 * Renders an inline SVG icon by name.
 * @param {string} name - key into ICONS; falls back to a plain circle.
 * @param {{size?: number, class?: string}} [opts]
 */
function icon(name, opts) {
  const size = (opts && opts.size) || 18;
  const cls = (opts && opts.class) || "";
  const body = ICONS[name] || ICONS.circle;
  return (
    `<svg class="icon${cls ? " " + cls : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${body}</svg>`
  );
}

module.exports = { icon, ICONS };
