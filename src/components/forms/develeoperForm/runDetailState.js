// Pure derivation for RunDetail/RunCompare (Phase 7c), kept out of the components for the same
// no-jsdom testability reason as monitoringSummary.js/logsExplorerState.js.

/** "10.4s" / "in progress" — a run's wall-clock duration, or its absence while still running. */
export const formatRunDuration = (run) => {
  if (!run?.startedAt) return '';
  if (!run.endedAt) return 'in progress';
  const ms = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
};

const STATUS_LABEL = { failed: 'Failed', succeeded: 'Succeeded', running: 'Running' };
export const formatRunStatusLabel = (status) => STATUS_LABEL[status] || status;

/**
 * Timeline rows (from GET /diagnostics/runs/:runId's derived `timeline`) into plain render
 * data — a clock-time label per row (run.startedAt + the row's own cumulative startOffsetMs)
 * plus a dot color, so the component only maps over strings.
 */
export const buildTimelineRows = (run, timeline) => {
  const startedAt = run?.startedAt ? new Date(run.startedAt) : null;
  return (timeline || []).map((entry) => ({
    ...entry,
    clockTime: startedAt ? new Date(startedAt.getTime() + entry.startOffsetMs).toLocaleTimeString() : '',
    dotColor: entry.status === 'failed' ? 'error' : entry.errorCount > 0 || (entry.warnCount || 0) > 0 ? 'warning' : 'success',
  }));
};

const SEVERITY_ORDER = { severe: 0, moderate: 1, info: 2 };

/** Diff rows sorted worst-first within a band — severe/moderate/info, matching the prototype's own ranking intent. */
export const sortDiffRows = (rows) => [...(rows || [])].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

const BAND_LABELS = {
  outcomes: 'Changed outcomes',
  volumes: 'Changed volumes',
  environment: 'Environment drift',
  inputs: 'Input differences',
  unchanged: 'Unchanged / low-signal fields',
};
export const bandLabel = (band) => BAND_LABELS[band] || band;

/** "value" rendered for a diff cell — undefined reads as an em dash; objects/arrays are
 * pretty-printed as JSON so nested structures don't collapse to "[object Object]". Truncated
 * at 800 chars to keep very large inputs (e.g. contentControls arrays) readable rather than
 * overwhelming — the caller adds white-space:pre-wrap so newlines render. */
export const formatDiffValue = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value, null, 2);
      return s.length > 800 ? `${s.slice(0, 800)}\n…` : s;
    } catch {
      return String(value);
    }
  }
  return String(value);
};
