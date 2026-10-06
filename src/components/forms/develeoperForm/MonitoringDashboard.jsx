import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  getDiagnosticsOverview,
  getDiagnosticsIssues,
  getServiceConnectionsHealth,
  resolveDiagnosticsIssue,
  getDiagnosticsRunBaseline,
} from '../../../store/data/docManagerApi';
import {
  buildHealthSentence,
  buildRunsSentence,
  formatRelativeTime,
  formatSignature,
  issueMetaTokens,
  issueHasBaselineContext,
} from './monitoringSummary';
import LogsExplorer from './LogsExplorer';
import RunDetail from './RunDetail';
import RunCompare from './RunCompare';
import IssueDetail from './IssueDetail';

// Reuses ServiceConnectionsDashboard's own background so Monitoring reads as a sibling card,
// not a different application bolted onto the same shell — see that component's own constant.
const DASHBOARD_BACKGROUND =
  'linear-gradient(145deg, rgba(15,23,42,0.03) 0%, rgba(2,132,199,0.07) 35%, rgba(20,184,166,0.06) 100%)';

const RESOLVED_RECENTLY_DAYS = 7;
const ATTENTION_REFRESH_MS = 15000;
const VIEW_ATTENTION = 'attention';
const VIEW_LOGS = 'logs';
const VIEW_RUN = 'run';
const VIEW_COMPARE = 'compare';
const VIEW_ISSUE = 'issue';

const MonitoringDashboard = ({ onViewConnections, userId }) => {
  const [view, setView] = useState(VIEW_ATTENTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [unresolvedIssues, setUnresolvedIssues] = useState([]);
  const [resolvedIssues, setResolvedIssues] = useState([]);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveError, setResolveError] = useState('');
  const [openRunId, setOpenRunId] = useState(null);
  // Set when Run detail jumps to the Logs filtered to its working session; cleared when the Logs
  // view is opened from the toggle, so a stale filter never lingers.
  const [logsRunFilter, setLogsRunFilter] = useState('');
  const [compareIds, setCompareIds] = useState(null);
  const [openIssueId, setOpenIssueId] = useState(null);
  const [comparingIssueId, setComparingIssueId] = useState(null);

  // `silent` is the background refresh: no spinner, no error banner (a failed background poll just
  // tries again next time), and nothing visible changes unless the data did.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const since = new Date(Date.now() - RESOLVED_RECENTLY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [healthPayload, overviewPayload, unresolvedPayload, resolvedPayload] = await Promise.all([
        getServiceConnectionsHealth(),
        getDiagnosticsOverview(),
        getDiagnosticsIssues({ status: 'unresolved' }),
        getDiagnosticsIssues({ status: 'resolved', since }),
      ]);
      setHealth(healthPayload);
      setOverview(overviewPayload);
      setUnresolvedIssues(unresolvedPayload?.issues || []);
      setResolvedIssues(resolvedPayload?.issues || []);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load Monitoring data.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keeps "Needs attention" current while it is on screen: new issues and counts appear without
  // pressing Refresh. Only while this view is showing and the tab is visible; the other views have
  // their own refresh (or none), and a hidden tab should not poll for nobody.
  useEffect(() => {
    if (view !== VIEW_ATTENTION) return undefined;
    const id = window.setInterval(() => {
      if (!document.hidden) load({ silent: true });
    }, ATTENTION_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [view, load]);

  const healthSentence = useMemo(() => buildHealthSentence(health?.services), [health]);
  const runsSentence = useMemo(() => buildRunsSentence(overview), [overview]);

  const sortedUnresolved = useMemo(
    () => [...unresolvedIssues].sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt)),
    [unresolvedIssues]
  );

  const handleResolve = async (issue) => {
    setResolveError('');
    setResolvingId(issue._id);
    try {
      await resolveDiagnosticsIssue(issue._id, userId);
      await load();
    } catch (err) {
      setResolveError(err.message || 'Failed to resolve issue.');
    } finally {
      setResolvingId(null);
    }
  };

  const openRun = (runId) => {
    setOpenRunId(runId);
    setView(VIEW_RUN);
  };

  const openCompare = (a, b) => {
    setCompareIds({ a, b });
    setView(VIEW_COMPARE);
  };

  const openIssue = (issueId) => {
    setOpenIssueId(issueId);
    setView(VIEW_ISSUE);
  };

  const handleCompareIssueToBaseline = async (issue) => {
    const latestRunId = issue.occurrenceRunIds?.[issue.occurrenceRunIds.length - 1];
    if (!latestRunId) return;
    setResolveError('');
    setComparingIssueId(issue._id);
    try {
      const { runId: baselineRunId } = await getDiagnosticsRunBaseline(latestRunId);
      openCompare(latestRunId, baselineRunId);
    } catch (err) {
      setResolveError(err.message || 'Failed to find a baseline run.');
    } finally {
      setComparingIssueId(null);
    }
  };

  const backToMonitoring = () => setView(VIEW_ATTENTION);

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, background: DASHBOARD_BACKGROUND }}>
      <Stack spacing={2}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant='h6' component='h2'>
              Monitoring
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Errors and failures across every DocGen service.
            </Typography>
          </Box>
          {view !== VIEW_RUN && view !== VIEW_COMPARE && view !== VIEW_ISSUE ? (
            <Stack direction='row' spacing={1} alignItems='center'>
              <ToggleButtonGroup
                size='small'
                exclusive
                value={view}
                onChange={(_e, next) => {
                  if (!next) return;
                  setLogsRunFilter('');
                  setView(next);
                }}
                aria-label='Monitoring view'
              >
                <ToggleButton value={VIEW_ATTENTION}>Needs attention</ToggleButton>
                <ToggleButton value={VIEW_LOGS}>Logs</ToggleButton>
              </ToggleButtonGroup>
              {view === VIEW_ATTENTION ? (
                <Button size='small' variant='outlined' startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
                  Refresh
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </Box>

        {view !== VIEW_RUN && view !== VIEW_COMPARE && view !== VIEW_ISSUE ? (
          <Box>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              {healthSentence} {runsSentence}
            </Typography>
            {typeof onViewConnections === 'function' ? (
              <Link component='button' variant='body2' onClick={onViewConnections} sx={{ mt: 0.5 }}>
                View service connections →
              </Link>
            ) : null}
          </Box>
        ) : null}

        <Divider sx={{ borderColor: (theme) => theme.palette.divider }} />

        {error ? <Alert severity='error'>{error}</Alert> : null}
        {resolveError ? <Alert severity='warning'>{resolveError}</Alert> : null}

        {view === VIEW_RUN ? (
          <RunDetail
            key={openRunId}
            runId={openRunId}
            onBack={backToMonitoring}
            onOpenCompare={openCompare}
            onShowInLogs={(sessionId) => {
              setLogsRunFilter(sessionId);
              setView(VIEW_LOGS);
            }}
          />
        ) : view === VIEW_ISSUE ? (
          <IssueDetail issueId={openIssueId} onBack={backToMonitoring} onOpenRun={openRun} />
        ) : view === VIEW_COMPARE ? (
          <RunCompare a={compareIds?.a} b={compareIds?.b} onBack={backToMonitoring} />
        ) : view === VIEW_LOGS ? (
          <LogsExplorer onOpenRun={openRun} initialRunId={logsRunFilter} />
        ) : loading && !overview ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant='subtitle2' sx={{ mb: 1 }}>
                Needs attention {sortedUnresolved.length > 0 ? `(${sortedUnresolved.length})` : ''}
              </Typography>
              {sortedUnresolved.length === 0 ? (
                <Paper variant='outlined' sx={{ p: 2 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Nothing needs attention right now.
                  </Typography>
                </Paper>
              ) : (
                <Paper variant='outlined'>
                  <Stack divider={<Divider />}>
                    {sortedUnresolved.map((issue) => {
                      const metaTokens = issueMetaTokens(issue);
                      const canCompare = issueHasBaselineContext(issue);
                      return (
                        <Box key={issue._id} sx={{ p: 2 }}>
                          <Link
                            component='button'
                            variant='body1'
                            underline='hover'
                            onClick={() => openIssue(issue._id)}
                            sx={{ fontWeight: 600, textAlign: 'left', color: 'text.primary' }}
                          >
                            {issue.regressedAt ? '⟲ ' : ''}
                            {issue.message || formatSignature(issue.signature)}
                          </Link>
                          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                            {metaTokens.join(' · ')} · Last seen {formatRelativeTime(issue.lastSeenAt)}
                          </Typography>
                          {issue.regressedAt ? (
                            <Typography variant='body2' color='error' sx={{ mt: 0.5 }}>
                              Regressed.
                            </Typography>
                          ) : null}
                          <Stack direction='row' spacing={1.5} sx={{ mt: 1.5 }}>
                            {canCompare ? (
                              <Button size='small' onClick={() => openRun(issue.occurrenceRunIds[issue.occurrenceRunIds.length - 1])}>
                                Open run
                              </Button>
                            ) : null}
                            {canCompare ? (
                              <Button
                                size='small'
                                disabled={comparingIssueId === issue._id}
                                onClick={() => handleCompareIssueToBaseline(issue)}
                              >
                                {comparingIssueId === issue._id ? 'Finding baseline…' : 'Compare to baseline'}
                              </Button>
                            ) : null}
                            <Button
                              size='small'
                              variant='contained'
                              disabled={resolvingId === issue._id}
                              onClick={() => handleResolve(issue)}
                            >
                              {resolvingId === issue._id ? 'Resolving…' : 'Resolve'}
                            </Button>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              )}
            </Box>

            <Box>
              <Link component='button' variant='body2' onClick={() => setShowResolved((prev) => !prev)}>
                {resolvedIssues.length > 0
                  ? `${resolvedIssues.length} issue${resolvedIssues.length === 1 ? '' : 's'} resolved in the last ${RESOLVED_RECENTLY_DAYS} days`
                  : `Nothing resolved in the last ${RESOLVED_RECENTLY_DAYS} days`}
              </Link>
              {showResolved && resolvedIssues.length > 0 ? (
                <Stack spacing={0.5} divider={<Divider />} sx={{ mt: 1 }}>
                  {resolvedIssues.map((issue) => (
                    <Box key={issue._id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
                      <Typography variant='body2'>{issue.message || formatSignature(issue.signature)}</Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {formatRelativeTime(issue.resolvedAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Box>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

export default MonitoringDashboard;
