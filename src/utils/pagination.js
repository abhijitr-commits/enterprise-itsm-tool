/*************************************************************
 * pagination.js — shared server-side pagination helper used by every
 * module's list controller (see the roadmap item "Add server-side
 * pagination to all list pages"). Before this, every list page did an
 * unbounded Model.find(filter) and rendered every matching row in one
 * shot — fine while a module had a handful of records, increasingly
 * slow (and eventually a real problem on the shared free MongoDB
 * Atlas M0 tier) as data accumulates over the life of the tool.
 *
 * Usage in a controller:
 *   const { parsePagination, buildPageInfo } = require("../utils/pagination");
 *   const { page, limit, skip } = parsePagination(req.query);
 *   const [rows, totalCount] = await Promise.all([
 *     Model.find(filter).sort({...}).skip(skip).limit(limit).lean(),
 *     Model.countDocuments(filter),
 *   ]);
 *   res.render("module/list", { rows, pageInfo: buildPageInfo(totalCount, page, limit), ... });
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

module.exports = { parsePagination, buildPageInfo, DEFAULT_LIMIT, MAX_LIMIT };
