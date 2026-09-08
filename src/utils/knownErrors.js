/*************************************************************
 * knownErrors.js — shared helper behind the audit backlog item
 * "Known Error Database (KEDB) for Problem Management." The KEDB
 * itself (problemController.listKnownErrors, views/problems/kedb.ejs)
 * is a searchable list a Service Desk agent can check by hand — this
 * is the second half: a best-effort "you might already have a
 * workaround for this" suggestion surfaced automatically on the
 * Incident detail page, so the agent doesn't have to think to go
 * looking.
 *
 * Matching is deliberately simple keyword overlap (the incident's
 * Category plus its own significant Subject words, matched against
 * known-error Titles) — no scoring model, same "good enough
 * suggestion, not a hard rule" philosophy as every other <datalist>
 * convenience in this app. Never throws: an incident with nothing
 * worth searching on just gets no suggestions.
 *************************************************************/
const Problem = require("../models/Problem");

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function suggestKnownErrorsFor(incident) {
  const rawTerms = [incident.category, ...String(incident.subject || "").split(/\s+/)];
  const terms = rawTerms
    .map((t) => String(t || "").trim())
    .filter((t) => t.length > 3)
    .slice(0, 8);

  if (!terms.length) return [];

  return Problem.find({
    knownError: "Yes",
    $or: terms.map((t) => ({ title: new RegExp(escapeRegex(t), "i") })),
  })
    .select("problemId title workaround status")
    .limit(3)
    .lean();
}

module.exports = { suggestKnownErrorsFor };
