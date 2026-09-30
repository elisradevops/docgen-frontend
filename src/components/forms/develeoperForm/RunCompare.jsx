import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { getDiagnosticsCompare, getDiagnosticsCompareReportUrl, getDiagnosticsRun, getDiagnosticsRuns } from '../../../store/data/docManagerApi';
import { sortDiffRows, bandLabel, formatDiffValue } from './runDetailState';

// LCS-based line diff for two JSON values. Caps at MAX_LINES per side before the quadratic
// table becomes heavy — objects that large are edge cases (e.g. a contentControls array with
// hundreds of entries) and the cap still surfaces the first batch of changes clearly.
const MAX_LINES = 300;

function diffJsonLines(a, b) {
  const serialize = (v) => {
    if (v === undefined) return '(not present)';
    try {
      const s = JSON.stringify(v, null, 2);
      return typeof s === 'string' ? s : String(v);
    } catch { return String(v); }
  };
  const linesA = serialize(a).split('\n').slice(0, MAX_LINES);
  const linesB = serialize(b).split('\n').slice(0, MAX_LINES);
  const m = linesA.length, n = linesB.length;

  // LCS DP table
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = linesA[i - 1] === linesB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrack to produce the diff
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.unshift({ type: 'same', line: linesA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', line: linesB[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', line: linesA[i - 1] });
      i--;
    }
  }
  return result;
}

const DIFF_LINE_STYLE = {
  same:    { color: '#64748b', bg: 'transparent',           prefix: '  ' },
  removed: { color: '#D1434B', bg: 'rgba(209,67,75,0.08)', prefix: '- ' },
  added:   { color: '#22863a', bg: 'rgba(34,134,58,0.08)', prefix: '+ ' },
};

// Shows a colored unified diff when both sides are objects/arrays; falls back to the simple
// A/B label pair for primitives.
function DiffCell({ a, b }) {
  const [open, setOpen] = useState(false);
  // Only plain objects (not arrays) warrant the LCS diff — arrays are now recursed into
  // field-by-field by the backend, so what arrives here is either a primitive or a small
  // primitive array that reads fine as a formatted value in the simple A/B display.
  const isObj = (v) => v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);

  if (!isObj(a) && !isObj(b)) {
    return (
      <Stack direction='row' spacing={2} sx={{ mt: 0.5 }}>
        <Typography variant='body2' sx={{ fontFamily: 'monospace' }} color='primary.main'>
          A: {formatDiffValue(a)}
        </Typography>
        <Typography variant='body2' sx={{ fontFamily: 'monospace' }} color='warning.main'>
          B: {formatDiffValue(b)}
        </Typography>
      </Stack>
    );
  }

  const diff = diffJsonLines(a ?? {}, b ?? {});
  const removed = diff.filter((l) => l.type === 'removed').length;
  const added   = diff.filter((l) => l.type === 'added').length;
  const summary = [removed ? `−${removed}` : null, added ? `+${added}` : null].filter(Boolean).join('  ');

  return (
    <Box sx={{ mt: 0.5 }}>
      <Box
        component='button'
        onClick={() => setOpen((v) => !v)}
        sx={{
          background: 'none', border: 'none', cursor: 'pointer', p: 0,
          fontSize: 12, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75,
        }}
      >
        {open ? '▴ Collapse' : '▾ Show diff'}
        {!open && summary ? (
          <Box component='span' sx={{ fontFamily: 'monospace', fontSize: 11 }}>
            {removed ? <Box component='span' sx={{ color: '#D1434B' }}>−{removed} </Box> : null}
            {added   ? <Box component='span' sx={{ color: '#22863a' }}>+{added}</Box>   : null}
          </Box>
        ) : null}
      </Box>
      {open ? (
        <Box
          component='pre'
          sx={{
            mt: 0.5, p: 1, m: 0,
            fontSize: 11, fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.03)',
            borderRadius: 1,
            maxHeight: 340,
            overflowY: 'auto',
            overflowX: 'auto',
            whiteSpace: 'pre',
            lineHeight: 1.6,
          }}
        >
          {diff.map((l, idx) => {
            const s = DIFF_LINE_STYLE[l.type];
            return (
              <Box
                key={idx}
                component='span'
                sx={{ display: 'block', color: s.color, background: s.bg, px: 0.5 }}
              >
                {s.prefix}{l.line}
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

const BANDS = ['outcomes', 'volumes', 'environment', 'inputs'];

// Splits "contentControls[tests-description-content-control].data.testSuiteArray"
// into ["contentControls", "[tests-description-content-control]", "data", "testSuiteArray"]
function fieldSegments(field) {
  const segs = [];
  const re = /\[([^\]]+)\]|([^.[]+)/g;
  let m;
  while ((m = re.exec(field)) !== null) {
    segs.push(m[1] !== undefined ? `[${m[1]}]` : m[2]);
  }
  return segs.length ? segs : [field];
}

// Shows only the leaf field name — the prefix path is identical across sibling rows and
// adds no information. Full path is surfaced on hover for the rare case where two leaf
// names collide across different parent paths.
function FieldPath({ field }) {
  const segs = fieldSegments(field || '');
  const leaf = segs[segs.length - 1] || field;
  return (
    <Tooltip title={field} placement='top-start' enterDelay={600}>
      <Box component='span' sx={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'text.primary', cursor: 'default' }}>
        {leaf}
      </Box>
    </Tooltip>
  );
}

// Renders a diff cell value with context-aware formatting:
// booleans as pills, primitive arrays as chip lists, strings/numbers as monospace.
function ValueDisplay({ value, removed }) {
  const col = removed ? '#9B0000' : '#006620';
  const chipBg = removed ? 'rgba(209,67,75,0.09)' : 'rgba(34,134,58,0.09)';
  const chipBorder = removed ? 'rgba(209,67,75,0.28)' : 'rgba(34,134,58,0.28)';

  if (value === undefined || value === null || value === '') {
    return <Box component='span' sx={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>—</Box>;
  }
  if (typeof value === 'boolean') {
    return (
      <Box component='span' sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: col, px: 0.75, py: '2px', borderRadius: '4px', background: chipBg }}>
        {String(value)}
      </Box>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Box component='span' sx={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>[ ]</Box>;
    }
    const allPrimitive = value.every((v) => v === null || typeof v !== 'object');
    if (allPrimitive) {
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {value.map((v, i) => (
            <Box key={i} component='span' sx={{ fontSize: 11, fontFamily: 'monospace', color: col, px: 0.6, py: '1px', borderRadius: '3px', border: '1px solid', borderColor: chipBorder, background: chipBg }}>
              {String(v)}
            </Box>
          ))}
        </Box>
      );
    }
    return <Box component='span' sx={{ fontFamily: 'monospace', fontSize: 12, color: col }}>[{value.length} items]</Box>;
  }
  return <Box component='span' sx={{ fontFamily: 'monospace', fontSize: 12, color: col, wordBreak: 'break-all' }}>{String(value)}</Box>;
}

// ── Run info display helpers ───────────────────────────────────────────────────────────────

function formatRunDate(startedAt) {
  if (!startedAt) return '—';
  return new Date(startedAt).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function triggerLabel(trigger) {
  return trigger === 'ui' ? 'via UI' : trigger === 'pipeline' ? 'via script' : trigger || '—';
}

// Extracts just the filename (without path) from a URL or file path string.
function fileBasename(url) {
  if (!url) return null;
  try {
    // Works for both http URLs and path strings like /foo/bar/file.docx
    return decodeURIComponent(url).split(/[\\/]/).filter(Boolean).pop() || null;
  } catch { return null; }
}

// Best display name for a run: generated doc filename > docType label > 'Unknown document'
function runDisplayName(run) {
  return fileBasename(run.documentUrl) || run.docType || 'Unknown document';
}

// Read-only card showing the current run (Run B). Displayed above the baseline selector.
function CurrentRunCard({ run, loading }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CircularProgress size={14} />
        <Typography variant='body2' color='text.secondary'>Loading run info…</Typography>
      </Box>
    );
  }
  if (!run) return null;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr auto' },
        alignItems: 'center',
        gap: { xs: 0.5, sm: 2 },
        px: 1.5,
        py: 1,
        borderRadius: 1,
        background: 'rgba(2,132,199,0.05)',
        border: '1px solid rgba(2,132,199,0.15)',
      }}
    >
      <Box>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.25 }}>
          Current run
        </Typography>
        <Typography variant='body2' sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>
          {runDisplayName(run)}
        </Typography>
      </Box>
      <Stack direction='row' spacing={2} flexWrap='wrap'>
        <Typography variant='caption' color='text.secondary'>
          {run.project || '—'}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {formatRunDate(run.startedAt)}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {run.userId || '—'} · {triggerLabel(run.trigger)}
        </Typography>
      </Stack>
      <Box
        sx={{
          fontSize: 11, fontFamily: 'monospace', px: 1, py: 0.25, borderRadius: 0.5,
          background: 'rgba(0,0,0,0.04)', color: 'text.secondary',
          whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' },
        }}
      >
        {run.runId.slice(0, 8)}…
      </Box>
    </Box>
  );
}

// Compact run description shown inside the Select dropdown options and the selected-value chip.
function RunOptionLabel({ run, compact = false }) {
  const name = runDisplayName(run);
  const date = formatRunDate(run.startedAt);
  const who = run.userId ? `${run.userId} · ${triggerLabel(run.trigger)}` : triggerLabel(run.trigger);

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography variant='body2' sx={{ fontWeight: 500, fontSize: 13 }} noWrap>
          {name}
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'nowrap' }}>
          {date}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0.25 }}>
      <Typography variant='body2' sx={{ fontWeight: 500, fontSize: 13 }}>
        {name}
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
        {date} · {who}
      </Typography>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────────────────

const RunCompare = ({ a: initialA, b: initialB, onBack }) => {
  const [baselineRunId, setBaselineRunId] = useState(initialA || '');
  const currentRunId = initialB || '';

  const [currentRun, setCurrentRun] = useState(null);
  const [currentRunLoading, setCurrentRunLoading] = useState(false);
  const [candidateRuns, setCandidateRuns] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState(null);
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Load the current run (Run B) metadata once.
  useEffect(() => {
    if (!currentRunId) return;
    setCurrentRunLoading(true);
    getDiagnosticsRun(currentRunId)
      .then((detail) => setCurrentRun(detail?.run || null))
      .catch(() => setCurrentRun(null))
      .finally(() => setCurrentRunLoading(false));
  }, [currentRunId]);

  // Once we know the current run's project+docType, load candidates for the baseline select.
  useEffect(() => {
    if (!currentRun?.project || !currentRun?.docType) return;
    setCandidatesLoading(true);
    getDiagnosticsRuns({
      project: currentRun.project,
      docType: currentRun.docType,
      status: 'succeeded',
      limit: 20,
      excludeRunId: currentRunId,
    })
      .then((runs) => setCandidateRuns(runs))
      .catch(() => setCandidateRuns([]))
      .finally(() => setCandidatesLoading(false));
  }, [currentRun?.project, currentRun?.docType, currentRunId]);

  // Load diff whenever both sides are known.
  const load = useCallback(async () => {
    if (!baselineRunId || !currentRunId) return;
    setLoading(true);
    setError('');
    try {
      setDiff(await getDiagnosticsCompare(baselineRunId, currentRunId));
    } catch (err) {
      setError(err.message || 'Failed to compare runs.');
    } finally {
      setLoading(false);
    }
  }, [baselineRunId, currentRunId]);

  useEffect(() => {
    load();
  }, [load]);

  const unchangedRows = useMemo(() => sortDiffRows(diff?.bands?.unchanged), [diff]);
  const reportUrl = baselineRunId && currentRunId
    ? getDiagnosticsCompareReportUrl(baselineRunId, currentRunId)
    : null;

  return (
    <Stack spacing={2}>
      <Link component='button' variant='body2' onClick={onBack}>
        ← Monitoring
      </Link>

      {/* ── Compare header ─────────────────────────────────────────────────── */}
      <Paper variant='outlined' sx={{ p: 2 }}>
        <Typography variant='h6' sx={{ mb: 1.5 }}>
          Compare runs
        </Typography>

        {/* Current run (Run B) — fixed, read-only */}
        <CurrentRunCard run={currentRun} loading={currentRunLoading} />

        {/* Baseline selector (Run A) */}
        <Box sx={{ mt: 1.5 }}>
          <FormControl size='small' fullWidth disabled={candidatesLoading || !currentRun}>
            <InputLabel>
              {candidatesLoading ? 'Loading baselines…' : 'Select baseline run'}
            </InputLabel>
            <Select
              label={candidatesLoading ? 'Loading baselines…' : 'Select baseline run'}
              value={baselineRunId}
              onChange={(e) => setBaselineRunId(e.target.value)}
              renderValue={(value) => {
                const run = candidateRuns.find((r) => r.runId === value);
                if (!run) return <Typography variant='body2' sx={{ fontFamily: 'monospace', fontSize: 12 }}>{value.slice(0, 20)}…</Typography>;
                return <RunOptionLabel run={run} compact />;
              }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
            >
              {candidateRuns.length === 0 ? (
                <MenuItem disabled>
                  <Typography variant='body2' color='text.secondary'>
                    {candidatesLoading ? 'Loading…' : 'No previous successful runs found'}
                  </Typography>
                </MenuItem>
              ) : (
                candidateRuns.map((run) => (
                  <MenuItem key={run.runId} value={run.runId} sx={{ py: 1 }}>
                    <RunOptionLabel run={run} />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>

        {/* Actions */}
        <Stack direction='row' spacing={1.5} sx={{ mt: 1.5 }} alignItems='center'>
          {reportUrl ? (
            <Link href={reportUrl} variant='body2' underline='hover'>
              Download report
            </Link>
          ) : null}
        </Stack>

        {diff?.crossType ? (
          <Alert severity='warning' sx={{ mt: 1.5 }}>
            Comparing runs of different document types / projects — results may reflect expected differences, not a defect.
          </Alert>
        ) : null}
      </Paper>

      {error ? <Alert severity='error'>{error}</Alert> : null}

      {/* ── Diff bands ─────────────────────────────────────────────────────── */}
      {loading && !diff ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : diff ? (
        <>
          {BANDS.map((band) => {
            const rows = sortDiffRows(diff.bands[band]);
            return (
              <Box key={band}>
                <Typography variant='subtitle2' sx={{ mb: 1 }}>
                  {bandLabel(band)} {rows.length > 0 ? `(${rows.length})` : ''}
                </Typography>
                <Paper variant='outlined' sx={{ overflow: 'hidden' }}>
                  {rows.length === 0 ? (
                    <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>Nothing to show.</Typography>
                  ) : (
                    <>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '45% 1fr 1fr', background: 'rgba(0,0,0,0.025)', borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant='caption' color='text.secondary' sx={{ px: 1.5, py: 0.75, display: 'block', fontWeight: 600 }}>Field</Typography>
                        <Typography variant='caption' sx={{ px: 1.5, py: 0.75, display: 'block', fontWeight: 600, color: '#9B0000', borderLeft: '1px solid', borderColor: 'divider' }}>Before</Typography>
                        <Typography variant='caption' sx={{ px: 1.5, py: 0.75, display: 'block', fontWeight: 600, color: '#006620', borderLeft: '1px solid', borderColor: 'divider' }}>After</Typography>
                      </Box>
                      {rows.map((row, i) => {
                        const isPlainObj = (v) => v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
                        const needsDiff = isPlainObj(row.a) || isPlainObj(row.b);
                        if (needsDiff) {
                          return (
                            <Box key={i} sx={{ borderBottom: i < rows.length - 1 ? '1px solid' : 'none', borderColor: 'divider', px: 1.5, py: 1 }}>
                              <FieldPath field={row.field} />
                              <Box sx={{ mt: 0.75 }}><DiffCell a={row.a} b={row.b} /></Box>
                            </Box>
                          );
                        }
                        return (
                          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '45% 1fr 1fr', borderBottom: i < rows.length - 1 ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { background: 'rgba(0,0,0,0.012)' } }}>
                            <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'flex-start' }}>
                              <FieldPath field={row.field} />
                            </Box>
                            <Box sx={{ px: 1.5, py: 1, borderLeft: '1px solid', borderColor: 'divider', background: 'rgba(209,67,75,0.04)', display: 'flex', alignItems: 'flex-start' }}>
                              <ValueDisplay value={row.a} removed={true} />
                            </Box>
                            <Box sx={{ px: 1.5, py: 1, borderLeft: '1px solid', borderColor: 'divider', background: 'rgba(34,134,58,0.04)', display: 'flex', alignItems: 'flex-start' }}>
                              <ValueDisplay value={row.b} removed={false} />
                            </Box>
                          </Box>
                        );
                      })}
                    </>
                  )}
                </Paper>
              </Box>
            );
          })}

          <Box>
            <Link component='button' variant='body2' onClick={() => setShowUnchanged((v) => !v)}>
              {showUnchanged ? 'Hide' : 'Show'} unchanged / low-signal fields ({unchangedRows.length})
            </Link>
            {showUnchanged ? (
              <Paper variant='outlined' sx={{ mt: 1 }}>
                <Stack divider={<Divider />}>
                  {unchangedRows.map((row, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1, fontSize: '0.82rem' }}>
                      <span>{row.field}</span>
                      <span style={{ fontFamily: 'monospace' }}>{formatDiffValue(row.a)}</span>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            ) : null}
          </Box>
        </>
      ) : null}
    </Stack>
  );
};

export default RunCompare;
