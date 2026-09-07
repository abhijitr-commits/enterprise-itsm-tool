/**
 * Small shared input-coercion helpers.
 *
 * A lot of controllers across this app take a numeric form field with
 * `Number(data.field) || fallback`. That reads as "use the fallback when
 * the field is empty/invalid" but it doesn't actually reject a negative
 * number — `Number("-5")` is `-5`, which is truthy, so `-5 || fallback`
 * evaluates to `-5` and a negative quantity/amount/count silently makes
 * it into the database. positiveNumber() closes that gap: anything that
 * isn't a finite number, or is below `min`, falls back instead of being
 * stored as-is.
 */
function positiveNumber(value, fallback, { min = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

module.exports = { positiveNumber };
