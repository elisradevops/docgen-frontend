// Pure derivation for the Logs explorer (Phase 7b), kept out of the component for the same
// no-jsdom testability reason monitoringSummary.js was (see its own header comment / 7a's
// ServiceConnectionsDashboard.test.jsx precedent).

const LEVEL_ORDER = ['error', 'warn', 'info', 'debug'];

/** Builds the query params sent to GET /diagnostics/events (and reused for facets/histogram). */
export const buildEventQueryParams = (state) => {
  const params = {};
  if (state.level?.length) params.level = state.level;
  if (state.service?.length) params.service = state.service;
  if (state.project?.length) params.project = state.project;
  if (state.docType?.length) params.docType = state.docType;
  if (state.q?.trim()) params.q = state.q.trim();
  if (state.since) {
    params.since = state.since;
  } else if (state.windowHours) {
    params.since = new Date(Date.now() - state.windowHours * 60 * 60 * 1000).toISOString();
  }
  if (state.until) params.until = state.until;
  if (state.sortBy) params.sortBy = state.sortBy;
  if (state.sortDir) params.sortDir = state.sortDir;
  return params;
};

const rowId = (event) => event?._id;

/**
 * Live-tail merge: prepends genuinely new rows (by _id, so a poll that returns an
 * already-seen row is a no-op) ahead of the existing list, capped per poll so a synthetic
 * burst can't flood the table in one tick, and the combined list is capped at maxTotal so
 * memory/DOM size stays bounded under a long-running tail.
 */
export const mergeLiveRows = (existingEvents, polledEvents, { capPerPoll = 200, maxTotal = 1000 } = {}) => {
  const existingIds = new Set(existingEvents.map(rowId));
  const genuinelyNew = polledEvents.filter((e) => !existingIds.has(rowId(e)));
  const capped = genuinelyNew.slice(0, capPerPoll);
  return [...capped, ...existingEvents].slice(0, maxTotal);
};

/** "Load older" pagination: appends at the end, deduped, never reordering existing rows. */
export const appendOlderEvents = (existingEvents, olderEvents) => {
  const existingIds = new Set(existingEvents.map(rowId));
  return [...existingEvents, ...olderEvents.filter((e) => !existingIds.has(rowId(e)))];
};

/**
 * Converts histogram buckets (from GET /diagnostics/events/histogram) into plain render data —
 * per-bucket segment heights (0-100) and a total, so the component only maps over numbers
 * rather than computing them inline. A zero-baseline, real axis, and a legend are the fixed
 * requirements from the master plan's own Phase 7 acceptance criteria (bars with no scale
 * communicate nothing).
 */
export const buildHistogramBars = (buckets) => {
  const totals = buckets.map((b) => LEVEL_ORDER.reduce((sum, lvl) => sum + (b.counts[lvl] || 0), 0));
  const max = Math.max(1, ...totals);
  return buckets.map((bucket, i) => ({
    bucketStart: bucket.bucketStart,
    total: totals[i],
    segments: LEVEL_ORDER.map((level) => ({
      level,
      count: bucket.counts[level] || 0,
      heightPct: totals[i] ? ((bucket.counts[level] || 0) / max) * 100 : 0,
    })),
  }));
};

/** "12:04 – 13:04" style label for a histogram bucket's hover tooltip. */
export const formatBucketRangeLabel = (bucketStart, bucketEndMs) => {
  const start = new Date(bucketStart);
  const end = new Date(start.getTime() + bucketEndMs);
  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
};

/** Facet popover search-to-filter: case-insensitive substring match over {value,count} rows. */
export const filterFacetValues = (facetValues, searchText) => {
  const needle = searchText.trim().toLowerCase();
  if (!needle) return facetValues;
  return facetValues.filter((f) => f.value.toLowerCase().includes(needle));
};
