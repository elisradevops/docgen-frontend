import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  getDiagnosticsRun,
  getDiagnosticsRunBaseline,
  getDiagnosticsRunReportUrl,
  getDiagnosticsEvents,
} from '../../../store/data/docManagerApi';
import {
  formatRunDuration,
  formatRunStatusLabel,
  buildTimelineRows,
  mergeRunLog,
  formatCaptureLabel,
  pickRunInput,
  buildInputFacts,
  formatResolvedRange,
} from './runDetailState';
import { formatStepLine } from './logsExplorerState';
// The same renderer the Documents tab uses for a document's input, so a run shows it identically.
import { SelectedInputPopoverContent } from '../documentsTab/SelectedInputPopover';
import { levelColors as LEVEL_COLOR, colors } from '../../../theme/tokens';

const STATUS_COLOR = { failed: 'error', succeeded: 'success', running: 'info' };
const LOG_PAGE_SIZE = 200;
const RUNNING_REFRESH_MS = 3000;
const ERROR_LIMIT = 50;

const SESSION_PREVIEW_LIMIT = 25;

const RunDetail = ({ runId, onBack, onOpenCompare, onShowInLogs }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [log, setLog] = useState([]);
  // Cursor for the next-older page of the run's log; undefined once the whole log is loaded.
  const [logCursor, setLogCursor] = useState(undefined);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // What was logged under this run's working session (the picker calls that led up to it).
  const [sessionEvents, setSessionEvents] = useState([]);
  const [sessionHasMore, setSessionHasMore] = useState(false);
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
      // Best effort and separate from the page's own load: a failure here must not hide the run.
      setSessionEvents([]);
      setSessionHasMore(false);
      if (detail.run?.sessionId) {
        try {
          const sessionRes = await getDiagnosticsEvents({
            runId: detail.run.sessionId,
            limit: SESSION_PREVIEW_LIMIT,
            sortBy: 'ts',
            sortDir: 'desc',
          });
          setSessionEvents(sessionRes.events || []);
          setSessionHasMore(!!sessionRes.nextCursor);
        } catch {
          // leave the section out
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load run.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  // The newest page and the run's errors, merged into what is already shown (older pages loaded with
  // "Load earlier" stay), with no spinner and no error banner — used while the run is still running.
  const refreshInFlightRef = useRef(false);
  const stickToBottomRef = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const [detail, tailRes, errorRes] = await Promise.all([
        getDiagnosticsRun(runId),
        getDiagnosticsEvents({ runId, limit: LOG_PAGE_SIZE, sortBy: 'ts', sortDir: 'desc' }),
        getDiagnosticsEvents({ runId, level: 'error', limit: ERROR_LIMIT, sortBy: 'ts', sortDir: 'desc' }),
      ]);
      // Follow the newest line only if the reader is already at the bottom: scrolling up to read
      // something must not be yanked back down by the next refresh.
      const el = logScrollRef.current;
      stickToBottomRef.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setRun(detail.run);
      setTimeline(detail.timeline || []);
      setLog((prev) => mergeRunLog(prev, tailRes.events, errorRes.events));
    } catch {
      // the next tick retries
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [runId]);

  useEffect(() => {
    if (stickToBottomRef.current && logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
    stickToBottomRef.current = false;
  }, [log]);

  const isRunning = run?.status === 'running';
  useEffect(() => {
    if (!isRunning) return undefined;
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, RUNNING_REFRESH_MS);
    // The effect re-runs when the status flips away from running, which clears this interval; one
    // last refresh is not needed because the flip itself came from a refresh that fetched everything.
    return () => window.clearInterval(id);
  }, [isRunning, refresh]);

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

  const runInput = useMemo(() => pickRunInput(run), [run]);
  const inputFacts = useMemo(() => buildInputFacts(runInput, run), [runInput, run]);
  const resolvedRange = useMemo(() => formatResolvedRange(run?.manifest?.inputs?.resolvedRange), [run]);
  const [inputOpen, setInputOpen] = useState(false);
  // A different run starts collapsed again.
  useEffect(() => {
    setInputOpen(false);
  }, [runId]);
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
              {isRunning ? (
                <Tooltip title='This run is still running — the page refreshes every few seconds until it finishes.'>
                  <Chip size='small' color='info' variant='outlined' label='Running · live' />
                </Tooltip>
              ) : null}
              {formatCaptureLabel(run) ? (
                <Tooltip title='Detailed (debug/info) logs were captured for this run, so its log below is longer than usual.'>
                  <Chip size='small' variant='outlined' color='warning' label={formatCaptureLabel(run)} />
                </Tooltip>
              ) : null}
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

          {runInput ? (
            <Paper variant='outlined'>
              {/* The whole header is the control (role=button): the label, the key facts and the
                  "Show details" cue all toggle it. The long summary is never printed here — only a
                  few short facts — so the header always fits and the cue is always visible. */}
              <Box
                role='button'
                tabIndex={0}
                aria-expanded={inputOpen}
                aria-controls='run-input-body'
                onClick={() => setInputOpen((open) => !open)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setInputOpen((open) => !open);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderRadius: 'inherit',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                }}
              >
                <Typography variant='subtitle2'>Input</Typography>
                <Stack direction='row' useFlexGap flexWrap='wrap' spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                  {inputFacts.map((fact) => (
                    <Tooltip key={fact.key} title={fact.full}>
                      <Chip
                        size='small'
                        variant='outlined'
                        label={fact.label ? `${fact.label}: ${fact.value}` : fact.value}
                        sx={{ maxWidth: '100%' }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
                <Box
                  component='span'
                  sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', color: 'primary.main', fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                >
                  {inputOpen ? 'Hide details' : 'Show details'}
                  {inputOpen ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
                </Box>
              </Box>
              <Collapse in={inputOpen} unmountOnExit>
                <Divider />
                <Box id='run-input-body' sx={{ p: 2, overflowX: 'auto' }}>
                  {resolvedRange ? (
                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 0.5 }}>
                        <Typography variant='subtitle2'>Resolved range</Typography>
                        <Button size='small' onClick={() => navigator.clipboard.writeText(resolvedRange.copyText)}>
                          Copy
                        </Button>
                      </Stack>
                      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.75 }}>
                        What this run actually used. Enter it in the UI to produce the same document by hand.
                      </Typography>
                      {resolvedRange.lines.map((line) => (
                        <Typography key={line} variant='body2'>
                          {line}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                  {runInput.kind === 'curated' ? (
                    <SelectedInputPopoverContent inputSummary={runInput.summary} inputDetails={runInput.details} />
                  ) : (
                    <Box>
                      <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
                        <Typography variant='caption' color='text.secondary'>
                          The request as recorded for this run (credentials are never stored).
                        </Typography>
                        <Button
                          size='small'
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(runInput.details, null, 2))}
                        >
                          Copy JSON
                        </Button>
                      </Stack>
                      <Box
                        component='pre'
                        sx={{ m: 0, p: 1.5, maxHeight: 320, overflow: 'auto', fontSize: '0.78rem', bgcolor: 'action.hover', borderRadius: 1 }}
                      >
                        {JSON.stringify(runInput.details, null, 2)}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          ) : null}

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

          {sessionEvents.length > 0 ? (
            <Box>
              <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                Activity before this run
              </Typography>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
                Warnings and errors from the pickers in the same working session (loading queries, test plans, favorites),
                newest first. They are not part of the run itself.
              </Typography>
              <Paper variant='outlined' sx={{ maxHeight: 220, overflowY: 'auto' }}>
                <Stack divider={<Divider />}>
                  {sessionEvents.map((e) => (
                    <Box
                      key={e._id}
                      sx={{ display: 'grid', gridTemplateColumns: '90px 50px 130px 1fr', gap: 1, p: 1, fontSize: '0.78rem', fontFamily: 'monospace' }}
                    >
                      <span>{new Date(e.ts).toLocaleTimeString()}</span>
                      <span style={{ color: LEVEL_COLOR[e.level], fontWeight: 700 }}>{String(e.level).toUpperCase()}</span>
                      <span style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.service}</span>
                      <span>{e.message}</span>
                    </Box>
                  ))}
                </Stack>
              </Paper>
              {onShowInLogs ? (
                <Button size='small' sx={{ mt: 1 }} onClick={() => onShowInLogs(run.sessionId)}>
                  {sessionHasMore ? `Show all in Logs (more than ${SESSION_PREVIEW_LIMIT})` : 'Show in Logs'}
                </Button>
              ) : null}
            </Box>
          ) : null}

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
                      <span>
                        {e.message}
                        {formatStepLine(e) ? (
                          <span style={{ display: 'block', fontSize: '0.7rem', color: colors.textSecondary }}>{formatStepLine(e)}</span>
                        ) : null}
                      </span>
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
