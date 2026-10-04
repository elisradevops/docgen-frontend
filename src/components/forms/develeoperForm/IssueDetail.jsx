import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Link, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { getDiagnosticsIssue } from '../../../store/data/docManagerApi';
import { formatRelativeTime, formatSignature, issueMetaTokens } from './monitoringSummary';
import { colors } from '../../../theme/tokens';

const STATUS_COLOR = { unresolved: 'warning', resolved: 'success' };

// A small single-series bar chart for "occurrence count per hour, last 24h" — HistogramSVG in
// LogsExplorer.jsx is the only other hand-rolled chart in this app, but it's coupled to
// per-level stacking/bucketMs/click-selection that don't apply to a single trend series, so this
// is its own, much smaller component. Reuses only the same ResizeObserver width-measurement and
// baseline-line approach.
function TrendBars({ trend }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const obs = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0].contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const CHART_H = 64;
  const BAR_GAP = 2;
  const n = trend.length || 1;
  const slotW = width / n;
  const barW = Math.max(1, slotW - BAR_GAP);
  const maxCount = Math.max(1, ...trend.map((t) => t.count));

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg width={width} height={CHART_H} style={{ display: 'block' }}>
        {width > 0 && (
          <>
            <line x1={0} y1={CHART_H} x2={width} y2={CHART_H} stroke='rgba(27,69,143,0.32)' strokeWidth={1} />
            {trend.map((t, i) => {
              const h = t.count > 0 ? Math.max(1, (t.count / maxCount) * (CHART_H - 2)) : 0;
              const x = i * slotW + BAR_GAP / 2;
              return (
                <Tooltip key={t.hoursAgo} title={`${t.count} occurrence${t.count === 1 ? '' : 's'}, ${t.hoursAgo}h ago`} placement='top'>
                  <rect x={x} y={CHART_H - h} width={barW} height={h} fill={colors.primary} opacity={0.85} rx={1} ry={1} />
                </Tooltip>
              );
            })}
          </>
        )}
      </svg>
    </Box>
  );
}

const IssueDetail = ({ issueId, onBack, onOpenRun }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [issue, setIssue] = useState(null);
  const [trend, setTrend] = useState([]);
  const [occurrences, setOccurrences] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDiagnosticsIssue(issueId);
      setIssue(data.issue);
      setTrend(data.trend || []);
      setOccurrences(data.occurrences || []);
    } catch (err) {
      setError(err.message || 'Failed to load issue.');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Link component='button' variant='body2' onClick={onBack}>
        ← Monitoring
      </Link>

      {error ? <Alert severity='error'>{error}</Alert> : null}

      {loading && !issue ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : issue ? (
        <>
          <Paper variant='outlined' sx={{ p: 2 }}>
            <Stack useFlexGap direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
              <Typography variant='h6'>{issue.message || formatSignature(issue.signature)}</Typography>
              <Chip size='small' color={STATUS_COLOR[issue.status] || 'default'} label={issue.status} />
            </Stack>
            <Stack useFlexGap direction='row' spacing={2} flexWrap='wrap' sx={{ mt: 1 }}>
              <Typography variant='body2' color='text.secondary'>
                {issueMetaTokens(issue).join(' · ')}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                first seen {formatRelativeTime(issue.firstSeenAt)}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                last seen {formatRelativeTime(issue.lastSeenAt)}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                count <b>{issue.count}</b>
              </Typography>
            </Stack>
            {issue.regressedAt ? (
              <Typography variant='body2' color='error' sx={{ mt: 1 }}>
                ⟲ Regressed {formatRelativeTime(issue.regressedAt)} — previously resolved
                {issue.resolvedAt ? ` ${formatRelativeTime(issue.resolvedAt)}` : ''}.
              </Typography>
            ) : null}
          </Paper>

          <Box>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              Occurrences over the last 24 hours
            </Typography>
            <Paper variant='outlined' sx={{ p: 2 }}>
              <TrendBars trend={trend} />
            </Paper>
          </Box>

          <Box>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              Occurrences {occurrences.length > 0 ? `(${occurrences.length})` : ''}
            </Typography>
            <Paper variant='outlined'>
              {occurrences.length === 0 ? (
                <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                  No occurrences recorded.
                </Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {occurrences.map((occ) => (
                    <Box
                      key={occ.runId}
                      sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
                          {occ.runId}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {occ.docType || '—'} · {occ.project || '—'} · {occ.status || '—'}
                          {occ.startedAt ? ` · ${new Date(occ.startedAt).toLocaleString()}` : ''}
                        </Typography>
                      </Box>
                      <Button size='small' onClick={() => onOpenRun?.(occ.runId)}>
                        Open run
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>
        </>
      ) : null}
    </Stack>
  );
};

export default IssueDetail;
