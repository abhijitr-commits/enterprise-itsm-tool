/*************************************************************
 * catalogRouting.js — shared helper behind the audit backlog item
 * "Structured Service Catalog with approval routing." Looks up the
 * RequestCatalog entry (if any) behind a Service Request's free-text
 * catalogItem field, the same case-insensitive nameKey match
 * serviceRequestController.recordCatalogUsage already uses to grow the
 * catalog. Kept separate from that controller so it can be reused by
 * the approval-decision paths (decideRequest/bulkDecideRequests)
 * without a circular require.
 *************************************************************/
const RequestCatalog = require("../models/RequestCatalog");

async function findCatalogEntryFor(catalogItemName) {
  const nameKey = String(catalogItemName || "").trim().toLowerCase();
  if (!nameKey) return null;
  return RequestCatalog.findOne({ nameKey }).lean();
}

module.exports = { findCatalogEntryFor };
