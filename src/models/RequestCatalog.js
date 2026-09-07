const mongoose = require("mongoose");

/*************************************************************
 * RequestCatalog.js — an admin-manageable catalog of Service
 * Request "types", closing the gap flagged in the Gap Analysis:
 * "Catalog Item" used to be pure free text with nothing backing
 * it. Two ways an entry ends up here, both kept live at once
 * per the user's own request:
 *
 *  1) MANUAL — a Service Desk/Manager/Administrator adds one
 *     directly via Manage Catalog (/requests/catalog), so the
 *     New Service Request form can offer a real, curated
 *     picklist with a category and description.
 *  2) AUTO — anyone filing a request is still free to type
 *     whatever they need (the field stays open text, never a
 *     locked dropdown); if what they typed doesn't already
 *     match an existing entry, serviceRequestController.js adds
 *     it here automatically the moment the request is created,
 *     tagged source:"auto" so it's obviously not curated yet.
 *     Either kind of entry is equally editable/deactivatable
 *     afterward from the Manage Catalog page — nothing about
 *     being auto-added locks it in "as typed".
 *
 * requestCount just tracks how often each entry has actually
 * been used, so whoever curates the catalog can see what's
 * popular (and worth writing a real description for) versus a
 * one-off typo that's safe to deactivate.
 *************************************************************/
const requestCatalogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Lowercased/trimmed copy of `name`, used for case-insensitive
    // de-dupe (so "New Laptop" and "new laptop" collapse to one entry)
    // without forcing `name` itself into a fixed casing.
    nameKey: { type: String, required: true, unique: true, index: true },
    category: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    source: { type: String, enum: ["manual", "auto"], default: "manual" },
    requestCount: { type: Number, default: 0 },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RequestCatalog", requestCatalogSchema);
