import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Link, Paper, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  getDiagnosticsRun,
  getDiagnosticsRunBaseline,
  getDiagnosticsRunReportUrl,
  getDiagnosticsEvents,
} from '../../../store/data/docManagerApi';
import { formatRunDuration, formatRunStatusLabel, buildTimelineRows, mergeRunLog } from './runDetailState';
import { levelColors as LEVEL_COLOR, colors } from '../../../theme/tokens';

const STATUS_COLOR = { failed: 'error', succeeded: 'success', running: 'info' };
const LOG_PAGE_SIZE = 200;
const ERROR_LIMIT = 50;

const RunDetail = ({ runId, onBack, onOpenCompare }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [log, setLog] = useState([]);
  // Cursor for the next-older page of the run's log; undefined once the whole log is loaded.
  const [logCursor, setLogCursor] = useState(undefined);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // The log is oldest-first, so a freshly loaded panel would otherwise open on its oldest rows
  // and hide the newest events and errors — the reason someone opens a failed run. Scrolled to
  // the bottom once per load; "Load earlier" must not move it.
  const logScrollRef = useRef(null);
  const [logLoadCount, setLogLoadCount] = useState(0);
  useEffect(() => {
    const el = logScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logLoadCount]);
  const [comparing, setComparing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyRunId = () => {
    navigator.clipboard.writeText(runId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The newest page of the log, plus every error from the whole run: in a verbose run the
      // failure is usually near the end, and a first-N-ascending page would cut it off.
      const [detail, tailRes, errorRes] = await Promise.all([
        getDiagnosticsRun(runId),
        getDiagnosticsEvents({ runId, limit: LOG_PAGE_SIZE, sortBy: 'ts', sortDir: 'desc' }),
        getDiagnosticsEvents({ runId, level: 'error', limit: ERROR_LIMIT, sortBy: 'ts', sortDir: 'desc' }),
      ]);
      setRun(detail.run);
      setTimeline(detail.timeline || []);
      setLog(mergeRunLog(tailRes.events, errorRes.events));
      setLogCursor(tailRes.nextCursor);
      setLogLoadCount((n) => n + 1);
    } catch (err) {
      setError(err.message || 'Failed to load run.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadEarlier = async () => {
    if (!logCursor) return;
    setLoadingEarlier(true);
    try {
      const res = await getDiagnosticsEvents({
        runId,
        limit: LOG_PAGE_SIZE,
        sortBy: 'ts',
        sortDir: 'desc',
        cursor: logCursor,
      });
      setLog((prev) => mergeRunLog(prev, res.events));
      setLogCursor(res.nextCursor);
    } catch (err) {
      setError(err.message || 'Failed to load earlier events.');
    } finally {
      setLoadingEarlier(false);
    }
  };

  const timelineRows = useMemo(() => buildTimelineRows(run, timeline), [run, timeline]);

  const handleCompareToBaseline = async () => {
    setComparing(true);
    setError('');
    try {
      const { runId: baselineRunId } = await getDiagnosticsRunBaseline(runId);
      onOpenCompare?.(runId, baselineRunId);
    } catch (err) {
      // The backend already returns a clear "No baseline run found" message on 404 — no need to
      // re-derive it client-side.
      setError(err.message || 'Failed to find a baseline run.');
    } finally {
      setComparing(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Link component='button' variant='body2' onClick={onBack}>
        ← Monitoring
      </Link>

      {error ? <Alert severity='error'>{error}</Alert> : null}

      {loading && !run ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : run ? (
        <>
          <Paper variant='outlined' sx={{ p: 2 }}>
            <Stack useFlexGap direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
              <Typography variant='h6' sx={{ fontFamily: 'monospace' }}>
                {run.runId}
              </Typography>
              <Tooltip title={copied ? 'Copied!' : 'Copy run ID'}>
                <IconButton size='small' onClick={handleCopyRunId} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Chip size='small' color={STATUS_COLOR[run.status] || 'default'} label={formatRunStatusLabel(run.status)} />
            </Stack>
            <Stack useFlexGap direction='row' spacing={2} flexWrap='wrap' sx={{ mt: 1 }}>
              <Typography variant='body2' color='text.secondary'>
                <b>{run.docType || 'unknown'}</b> · {run.project || 'unknown'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                trigger: <b>{run.trigger}</b>
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                started {new Date(run.startedAt).toLocaleString()}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                duration <b>{formatRunDuration(run)}</b>
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1.5} sx={{ mt: 2 }}>
              <Button size='small' variant='contained' onClick={handleCompareToBaseline} disabled={comparing}>
                {comparing ? 'Finding baseline…' : 'Compare to baseline'}
              </Button>
              <Button size='small' variant='outlined' component='a' href={getDiagnosticsRunReportUrl(run.runId)}>
                Download report
              </Button>
            </Stack>
          </Paper>

          <Box>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              Timeline
            </Typography>
            <Paper variant='outlined'>
              {timelineRows.length === 0 ? (
                <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                  No timeline recorded for this run.
                </Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {timelineRows.map((t, i) => (
                    <Box key={`${t.name}-${i}`} sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: 0.7, bgcolor: `${t.dotColor}.main` }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant='body2'>
                          <b>{t.name}</b> <Typography component='span' variant='caption' color='text.secondary'>({t.service})</Typography>
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {t.clockTime} · {t.durationMs}ms{t.errorCount ? ` · ${t.errorCount} error(s)` : ''}
                          {t.warnCount ? ` · ${t.warnCount} warning(s)` : ''}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>

          <Box>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              Error chain
            </Typography>
            <Paper variant='outlined'>
              {!run.errorChain?.length ? (
                <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                  No error chain — this run succeeded cleanly.
                </Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {run.errorChain.map((entry, i) => (
                    <Box key={i} sx={{ p: 1.5 }}>
                      <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {entry.service}
                        {entry.step ? ` — ${entry.step}` : ''}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {entry.message}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>

          <Box>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              Run log · all services, time-ordered
            </Typography>
            {logCursor ? (
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
                Showing the newest {LOG_PAGE_SIZE} events plus the run&apos;s errors — earlier events are not shown yet.
              </Typography>
            ) : null}
            <Paper ref={logScrollRef} variant='outlined' sx={{ maxHeight: 360, overflowY: 'auto' }}>
              {log.length === 0 ? (
                <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                  No log events captured for this run.
                </Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {logCursor ? (
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Button size='small' onClick={loadEarlier} disabled={loadingEarlier}>
                        {loadingEarlier ? 'Loading…' : 'Load earlier events'}
                      </Button>
                    </Box>
                  ) : null}
                  {log.map((e) => (
                    <Box key={e._id} sx={{ display: 'grid', gridTemplateColumns: '90px 50px 130px 1fr', gap: 1, p: 1, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      <span>{new Date(e.ts).toLocaleTimeString()}</span>
                      <span style={{ color: LEVEL_COLOR[e.level], fontWeight: 700 }}>{e.level.toUpperCase()}</span>
                      <span style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.service}</span>
                      <span>{e.message}</span>
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

export default RunDetail;
