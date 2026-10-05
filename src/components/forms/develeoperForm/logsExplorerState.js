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

/**
 * Live-tail burst signal: how many more events matched the poll's (incremental, since-last-poll)
 * window than the page actually returned. 0 means nothing was dropped — either matchedCount
 * wasn't requested/returned, or the page held everything that matched.
 */
export const computeLiveOverflow = (matchedCount, receivedCount) => {
  if (typeof matchedCount !== 'number') return 0;
  return Math.max(0, matchedCount - receivedCount);
};

/** Most rows the table will hold; past it the user is asked to narrow the query instead. */
export const LOG_ROW_CAP = 2000;

export const hasReachedRowCap = (rowCount, maxTotal = LOG_ROW_CAP) => rowCount >= maxTotal;

/**
 * "Load older" pagination: appends at the end, deduped, never reordering existing rows, and
 * never growing past maxTotal (the oldest overflow is dropped) so the table stays bounded.
 */
export const appendOlderEvents = (existingEvents, olderEvents, { maxTotal = LOG_ROW_CAP } = {}) => {
  const existingIds = new Set(existingEvents.map(rowId));
  return [...existingEvents, ...olderEvents.filter((e) => !existingIds.has(rowId(e)))].slice(0, maxTotal);
};

/** Live tail prepends new rows, so it only makes sense for the newest-first time sort. */
export const canLiveTail = (sortBy, sortDir) => sortBy === 'ts' && sortDir === 'desc';

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

/** "GET https://host/path -> 404" one-liner for a failed-request context; '' when there is none. */
export const formatRequestLine = (context) => {
  if (!context?.url && !context?.method) return '';
  const target = [context.method, context.url].filter(Boolean).join(' ');
  return context.status ? `${target} -> ${context.status}` : target;
};

/**
 * Which generation stage (and content control) a record belongs to: "generate-content-control › Test
 * Plan". Either part may be missing; '' when there is neither (an interactive request, a system line).
 */
export const formatStepLine = (record) =>
  [record?.step, record?.contentControlTitle].filter((part) => typeof part === 'string' && part.trim()).join(' › ');

/** Multi-line detail block (request line, attempt, body, server response); '' when no context. */
export const formatRequestDetail = (context) => {
  const line = formatRequestLine(context);
  if (!line) return '';
  const parts = [line];
  if (context.attempt) parts.push(`Attempt: ${context.attempt}`);
  if (context.requestBody) parts.push(`Body: ${context.requestBody}`);
  if (context.responseExcerpt) parts.push(`Response: ${context.responseExcerpt}`);
  return parts.join('\n');
};

/** Text of the per-row "Details" expander: request detail then stack; '' when neither exists. */
export const buildDetailsText = (record) =>
  [formatRequestDetail(record?.context), record?.err?.stack].filter(Boolean).join('\n\n');

// Spreadsheet apps evaluate cells starting with these as formulas (CSV injection). Prefixing a
// quote neutralises them; a legitimate value that starts with '-' or '+' also gains the prefix.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

const escapeCsvCell = (val) => {
  let s = val == null ? '' : String(val);
  if (FORMULA_LEAD.test(s)) s = `'${s}`;
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildLogsCsv = (events) => {
  const header = 'Time,Level,Service,Project,Type,Run,Step,Message,Request,Stack';
  const rows = events.map((e) =>
    [
      e.ts ? new Date(e.ts).toISOString() : '',
      e.level || '',
      e.service || '',
      e.project || '',
      e.docType || '',
      e.runId || '',
      formatStepLine(e),
      e.message || '',
      formatRequestDetail(e.context),
      e.err?.stack || '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return [header, ...rows].join('\n');
};

/**
 * api-gate mints `req-<uuid>` for requests that are not document generation (pickers, polling),
 * so they carry a correlation id without pretending to be a run. They have no run detail page.
 */
export const isRequestId = (id) => typeof id === 'string' && id.startsWith('req-');

/** `ses-<uuid>`: the frontend's working session; picker calls are logged under it. Not a run either. */
export const isSessionId = (id) => typeof id === 'string' && id.startsWith('ses-');

/** Ids that only correlate log lines — there is no run behind them, so no run detail to open. */
export const isCorrelationOnlyId = (id) => isRequestId(id) || isSessionId(id);

/** Short label for the Run column: 8 chars of a run id, or "req ·" / "session ·" plus 6 chars. */
export const formatRunCellLabel = (id) => {
  if (isRequestId(id)) return `req · ${id.slice(4, 10)}`;
  if (isSessionId(id)) return `session · ${id.slice(4, 10)}`;
  return String(id).slice(0, 8);
};

// The Time column starts controlled at "descend" (newest first). antd's default cycle is
// ascend → descend → cancel, so from "descend" the next click was "cancel", which maps back to
// newest-first: the column could never reach ascending. Descend first makes the cycle
// descend → ascend → cancel(→ newest first again).
export const TIME_SORT_DIRECTIONS = ['descend', 'ascend'];

/** The query's sort for an antd Table `sorter`; a cancelled sorter falls back to newest first. */
export const sortStateFromSorter = (sorter) =>
  sorter?.order && sorter?.columnKey
    ? { sortBy: sorter.columnKey, sortDir: sorter.order === 'ascend' ? 'asc' : 'desc' }
    : { sortBy: 'ts', sortDir: 'desc' };

