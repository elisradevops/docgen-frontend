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

/**
 * Merges run-log event lists into one chronological list: deduped by _id, oldest first (ties by
 * _id). Used to show the newest page of a run's log together with every error from the whole
 * run, and to prepend older pages on "Load earlier".
 */
export const mergeRunLog = (...lists) => {
  const byId = new Map();
  for (const list of lists) for (const e of list || []) byId.set(e._id, e);
  return [...byId.values()].sort((a, b) => {
    const diff = new Date(a.ts) - new Date(b.ts);
    return diff !== 0 ? diff : String(a._id).localeCompare(String(b._id));
  });
};

/**
 * Label for the "extra logging was on" chip: only a run that was actually captured (requested
 * and authorized — api-gate stores captureMode only then) gets one; a normal run gets none.
 */
export const formatCaptureLabel = (run) => {
  if (run?.captureMode === 'verbose') return 'Verbose capture';
  if (run?.captureMode === 'retain-on-failure') return 'Capture on failure';
  return '';
};

/**
 * What to show as a run's "Input". The curated input (the same summary/details the Documents tab
 * shows) when the run has one; otherwise the technical inputs recorded in the manifest, which
 * every run has (a run started by a pipeline has no curated one); otherwise nothing.
 */
export const pickRunInput = (run) => {
  const summary = typeof run?.input?.summary === 'string' ? run.input.summary.trim() : '';
  const details =
    run?.input?.details && typeof run.input.details === 'object' && !Array.isArray(run.input.details)
      ? run.input.details
      : null;
  if (summary || details) return { kind: 'curated', summary, details };

  const inputs = run?.manifest?.inputs;
  if (inputs && typeof inputs === 'object' && !Array.isArray(inputs) && Object.keys(inputs).length > 0) {
    return { kind: 'technical', summary: '', details: inputs };
  }
  return null;
};

const sourceLabel = (source) => (source === 'auto' ? 'auto-discovered' : source === 'explicit' ? 'as requested' : '');

const rangeSide = (side) => {
  if (!side || typeof side !== 'object') return { id: '', text: 'not recorded' };
  if (side.id === undefined || side.id === null) {
    if (side.source === 'none') return { id: '', text: 'none found (a baseline run)' };
    return { id: '', text: side.source === 'auto' ? 'not resolved — auto-discovery found nothing' : 'not recorded' };
  }
  const name = side.name ? ` (${side.name})` : '';
  const how = sourceLabel(side.source);
  return { id: String(side.id), text: `#${side.id}${name}${how ? ` — ${how}` : ''}` };
};

/**
 * What an SVD run actually resolved its range to (api-gate stores it in manifest.inputs.resolvedRange),
 * as a short chip label and plain lines. An omitted from/to is auto-discovered, so this is what to enter
 * in the UI to produce the same document by hand. Returns null when the run recorded none.
 */
export const formatResolvedRange = (range) => {
  if (!range || typeof range !== 'object' || Array.isArray(range)) return null;
  const kind = range.rangeType === 'pipeline' ? 'pipeline' : 'release';
  const from = rangeSide(range.from);
  const to = rangeSide(range.to);
  const definitionName = range.definition?.name ? String(range.definition.name) : '';
  const definitionId = range.definition?.id !== undefined ? ` #${range.definition.id}` : '';
  const definition = definitionName ? `${definitionName}${definitionId}` : definitionId.trim();
  const definitionLabel = definitionName || definitionId.trim();
  const chip = `${kind}${definitionLabel ? ` ${definitionLabel}` : ''}: ${from.id ? `#${from.id}` : '?'} → ${to.id ? `#${to.id}` : '?'}`;
  const lines = [
    `${kind === 'pipeline' ? 'Pipeline' : 'Release definition'}: ${definition || 'not recorded'}`,
    `From: ${from.text}`,
    `To: ${to.text}`,
  ];
  return { chip, lines, copyText: lines.join('\n') };
};

/** Label and tone for one finding in the Compare screen. */
export const findingLabel = (severity) =>
  severity === 'severe'
    ? { label: 'Differs', color: 'error' }
    : severity === 'moderate'
      ? { label: 'Check', color: 'warning' }
      : { label: 'Note', color: 'default' };

const MAX_FACTS = 4;
const MAX_FACT_LEN = 40;
const SUMMARY_PREVIEW_LEN = 80;

const clampText = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// "STD.dotx" out of ".../templates/shared/STD/STD.dotx?X-Amz-Signature=..." — a template shown by its
// file name, never a URL (which may carry a presigned query).
const fileNameOf = (url) => {
  const last = String(url ?? '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

const controlCountLabel = (list) =>
  Array.isArray(list) && list.length > 0 ? `${list.length} content control${list.length === 1 ? '' : 's'}` : '';

/**
 * A few short "key facts" for the collapsed Input card — document type, template, context, how many
 * content controls — so the header says what the run was asked to do without printing the (up to 1024
 * characters) summary on one line. At most 4, each clamped, each keeping its full text for a tooltip.
 * Returns [] when there is nothing to say.
 */
export const buildInputFacts = (runInput, run) => {
  if (!runInput) return [];
  const facts = [];
  const add = (key, label, value) => {
    const full = String(value ?? '').trim();
    if (full) facts.push({ key, label, value: clampText(full, MAX_FACT_LEN), full });
  };
  const rangeView = formatResolvedRange(run?.manifest?.inputs?.resolvedRange);

  if (runInput.kind === 'technical') {
    const inputs = runInput.details || {};
    add('template', 'Template', fileNameOf(inputs.templateName));
    add('project', 'Project', inputs.project);
    add('range', 'Range', rangeView?.chip);
    add('controls', '', controlCountLabel(inputs.contentControls));
  } else if (runInput.details) {
    const details = runInput.details;
    add('docType', 'Type', details.docType || run?.docType);
    add('template', 'Template', details.template?.name || fileNameOf(run?.templateName));
    add('range', 'Range', rangeView?.chip);
    add('context', 'Context', details.contextName);
    add('controls', '', controlCountLabel(details.contentControls));
  } else if (runInput.summary) {
    // Summary only (no details object): a short preview, not the whole line.
    const full = runInput.summary.trim();
    facts.push({ key: 'summary', label: '', value: clampText(full, SUMMARY_PREVIEW_LEN), full });
  }
  return facts.slice(0, MAX_FACTS);
};

