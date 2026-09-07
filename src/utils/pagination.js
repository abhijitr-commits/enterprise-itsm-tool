/*************************************************************
 * pagination.js — shared server-side pagination helper used by every
 * module's list controller (see the roadmap item "Add server-side
 * pagination to all list pages"). Before this, every list page did an
 * unbounded Model.find(filter) and rendered every matching row in one
 * shot — fine while a module had a handful of records, increasingly
 * slow (and eventually a real problem on the shared free MongoDB
 * Atlas M0 tier) as data accumulates over the life of the tool.
 *
 * Usage in a controller (preferred — see paginate() below for why):
 *   const { paginate } = require("../utils/pagination");
 *   const { rows, pageInfo } = await paginate(Model, filter, { createdDate: -1 }, req.query);
 *   res.render("module/list", { rows, pageInfo, ... });
 *
 * paginate() runs countDocuments() first and clamps the requested page
 * to the real last page BEFORE running find() — so the rows returned
 * always match what pageInfo says is being shown. An earlier version of
 * this helper ran find()+countDocuments() in parallel with the raw
 * (unclamped) page number, which is fine for any in-range page but
 * produces a confusing mismatch for an out-of-range one: e.g. a stale
 * bookmarked ?page=5 after filtering down to 1 page of results renders
 * an empty table under a pagination bar that still claims "Showing all
 * N" (built from the clamped page) — table and caption disagree. Two
 * sequential queries instead of one parallel pair is a non-issue at
 * this app's scale; correctness here is worth more than the shaved
 * round-trip. parsePagination()/buildPageInfo() are still exported
 * below for call sites that need the pieces separately (e.g. the
 * verify_views.js harness, which builds a pageInfo fixture directly
 * without a real Model to query).
 *
 * Usage in the matching view, right after the closing </table> (inside
 * the same .panel div so it shares the panel's padding/border):
 *   <%- include('../partials/pagination', { pageInfo }) %>
 *
 * The partial itself reads res.locals.currentPath / currentQuery
 * (both set globally in middleware/auth.js) to build Prev/Next links
 * that preserve every other active filter — no per-view wiring needed
 * beyond passing pageInfo through.
 *************************************************************/
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Reads page/limit off req.query, clamped to sane bounds. */
function parsePagination(query, defaultLimit = DEFAULT_LIMIT) {
  let page = parseInt(query && query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limit = parseInt(query && query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/** Turns a raw count + the requested page/limit into everything the view needs. */
function buildPageInfo(totalCount, page, limit) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  return {
    page: clampedPage,
    limit,
    totalCount,
    totalPages,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
    from: totalCount === 0 ? 0 : (clampedPage - 1) * limit + 1,
    to: Math.min(clampedPage * limit, totalCount),
  };
}

/**
 * Runs a paginated Model.find(filter) and returns rows that are always
 * consistent with the pageInfo built alongside them — see the header
 * comment above for why this clamps before querying instead of after.
 *
 * @param {import("mongoose").Model} model
 * @param {object} filter - same filter object the controller already builds
 * @param {object|string} sort - passed straight to .sort()
 * @param {object} query - req.query (reads .page / .limit off it)
 * @param {number} [defaultLimit]
 * @returns {Promise<{ rows: object[], totalCount: number, pageInfo: object }>}
 */
async function paginate(model, filter, sort, query, defaultLimit = DEFAULT_LIMIT) {
  const { limit } = parsePagination(query, defaultLimit);

  let rawPage = parseInt(query && query.page, 10);
  if (!Number.isFinite(rawPage) || rawPage < 1) rawPage = 1;

  const totalCount = await model.countDocuments(filter);
  const pageInfo = buildPageInfo(totalCount, rawPage, limit);
  const skip = (pageInfo.page - 1) * limit;

  const rows = await model.find(filter).sort(sort).skip(skip).limit(limit).lean();

  return { rows, totalCount, pageInfo };
}

module.exports = { parsePagination, buildPageInfo, paginate, DEFAULT_LIMIT, MAX_LIMIT };
