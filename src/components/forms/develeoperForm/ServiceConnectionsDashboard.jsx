import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { getServiceConnectionsHealth } from '../../../store/data/docManagerApi';

const AUTO_REFRESH_MS = 2 * 60 * 1000;
const AUTO_REFRESH_SECONDS = Math.ceil(AUTO_REFRESH_MS / 1000);
const STATUS_HIGHLIGHT_MS = 3200;
const DASHBOARD_BACKGROUND =
  'linear-gradient(145deg, rgba(15,23,42,0.03) 0%, rgba(2,132,199,0.07) 35%, rgba(20,184,166,0.06) 100%)';
const PRIMARY_SERVICE_BACKGROUND =
  'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(20,184,166,0.08) 100%)';
const DEPENDENCY_GRID_TEMPLATE =
  'minmax(90px,1fr) minmax(86px,0.9fr) minmax(58px,0.6fr) minmax(0,1.9fr)';
const DEFAULT_HEALTH_SUMMARY = Object.freeze({ monitored: 0, healthy: 0, degraded: 0, down: 0, avgLatency: null });

/**
 * Converts service status and connection state into a sortable severity number.
 * Higher numbers indicate a more severe state.
 */
const getSeverityLevel = (status, connectionStatus) => {
  const normalizedStatus = String(status || '').toLowerCase();
  const normalizedConnection = String(connectionStatus || '').toLowerCase();

  if (
    normalizedStatus === 'down' ||
    normalizedStatus === 'error' ||
    normalizedConnection === 'disconnected'
  ) {
    return 2;
  }

  if (
    normalizedStatus === 'degraded' ||
    normalizedConnection === 'degraded' ||
    normalizedStatus === 'connecting' ||
    normalizedConnection === 'connecting'
  ) {
    return 1;
  }

  if (normalizedStatus === 'up' || normalizedConnection === 'connected') {
    return 0;
  }

  return 1;
};

/**
 * Returns UI metadata for status chips.
 */
const getStatusMeta = (status, connectionStatus) => {
  const severity = getSeverityLevel(status, connectionStatus);
  if (severity === 0) {
    return {
      severity,
      label: 'Up',
      color: 'success',
      icon: <CheckCircleOutlineIcon fontSize='small' />,
    };
  }
  if (severity === 1) {
    return {
      severity,
      label: 'Degraded',
      color: 'warning',
      icon: <ReportProblemOutlinedIcon fontSize='small' />,
    };
  }
  return {
    severity,
    label: 'Down',
    color: 'error',
    icon: <ErrorOutlineIcon fontSize='small' />,
  };
};

/**
 * Stable sorting comparator used for both services and dependencies.
 */
const compareBySeverityThenName = (left, right) => {
  const severityDiff =
    getSeverityLevel(right?.status, right?.connectionStatus) -
    getSeverityLevel(left?.status, left?.connectionStatus);
  if (severityDiff !== 0) return severityDiff;
  return String(left?.displayName || left?.key || '').localeCompare(
    String(right?.displayName || right?.key || ''),
  );
};

/**
 * Sorts health services with API Gate pinned first and nested dependencies sorted by severity.
 */
const sortServicesWithApiGateFirst = (services = []) => {
  const mapped = services.map((service) => ({
    ...service,
    dependencies: Array.isArray(service?.dependencies)
      ? [...service.dependencies].sort(compareBySeverityThenName)
      : [],
  }));

  return mapped.sort((left, right) => {
    if (left?.key === 'api-gate' && right?.key !== 'api-gate') return -1;
    if (right?.key === 'api-gate' && left?.key !== 'api-gate') return 1;
    return compareBySeverityThenName(left, right);
  });
};

const formatDateTime = (isoDate) => {
  const value = String(isoDate || '').trim();
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatCountdown = (secondsRemaining) => {
  const safeValue = Math.max(0, Number(secondsRemaining) || 0);
  const minutes = Math.floor(safeValue / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safeValue % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const formatLatency = (responseTimeMs) => {
  if (typeof responseTimeMs !== 'number') return '-';
  return `${Math.max(0, Math.round(responseTimeMs))} ms`;
};

/**
 * Extracts a DNS host value from raw Node.js ENOTFOUND/getaddrinfo errors.
 */
const extractDnsHostFromText = (text) => {
  const value = String(text || '').trim();
  if (!value) return '';

  const fromGetaddrinfo = value.match(/getaddrinfo\s+ENOTFOUND\s+([^\s:]+)/i)?.[1];
  if (fromGetaddrinfo) return fromGetaddrinfo;

  const enotfoundMatches = [...value.matchAll(/ENOTFOUND\s+([^\s:]+)/gi)]
    .map((match) => String(match?.[1] || '').trim())
    .filter((candidate) => candidate && candidate.toLowerCase() !== 'getaddrinfo');

  if (enotfoundMatches.length > 0) {
    return enotfoundMatches[enotfoundMatches.length - 1];
  }

  return '';
};

/**
 * Normalizes errors from the dashboard's top-level /health fetch call.
 */
const normalizeHealthFetchError = (error) => {
  const raw = String(error?.message || '').trim();
  if (/ENOTFOUND/i.test(raw)) {
    const unresolvedHost = extractDnsHostFromText(raw) || 'api-gate-host';
    return {
      message: `API Gate host "${unresolvedHost}" could not be resolved.`,
      hint: 'Check Docker service name/network alias and API Gate base URL.',
      errorCode: 'ENOTFOUND',
    };
  }

  if (/ECONNREFUSED/i.test(raw)) {
    return {
      message: 'API Gate refused the connection.',
      hint: 'Verify the dg-api-gate service is running and listening on the configured port.',
      errorCode: 'ECONNREFUSED',
    };
  }

  if (/(ETIMEDOUT|ECONNABORTED|timeout)/i.test(raw)) {
    return {
      message: 'API Gate health check timed out.',
      hint: 'The service may be overloaded or unreachable. Check container health and network.',
      errorCode: 'ETIMEDOUT',
    };
  }

  if (/network error|failed to fetch|err_network/i.test(raw) || !raw) {
    return {
      message: 'API Gate is down or unreachable.',
      hint: 'Cannot fetch /health from API Gate. Verify the dg-api-gate container and network.',
      errorCode: 'ERR_NETWORK',
    };
  }

  return {
    message: raw,
    hint: 'Unable to fetch service health from API Gate.',
    errorCode: 'HEALTH_FETCH_FAILED',
  };
};

/**
 * Creates a synthetic payload when API Gate itself is unreachable.
 */
const createApiGateUnavailablePayload = (normalizedError, previousPayload = null) => {
  const checkedAt = new Date().toISOString();
  const previousApiGate = Array.isArray(previousPayload?.services)
    ? previousPayload.services.find((service) => service?.key === 'api-gate')
    : null;

  return {
    service: 'dg-api-gate',
    status: 'down',
    connectionStatus: 'disconnected',
    version: String(previousApiGate?.version || previousPayload?.version || 'unknown'),
    checkedAt,
    services: [
      {
        key: 'api-gate',
        displayName: 'API Gate',
        status: 'down',
        connectionStatus: 'disconnected',
        version: String(previousApiGate?.version || previousPayload?.version || 'unknown'),
        checkedAt,
        error: normalizedError.message,
        hint: normalizedError.hint,
        errorCode: normalizedError.errorCode,
        dependencies: [],
      },
    ],
  };
};

/**
 * Maps low-level probe messages into explicit, user-facing diagnostics.
 */
const normalizeErrorDetails = (target = {}) => {
  const raw = String(target?.error || '').trim();
  const hint = String(target?.hint || '').trim();
  const configKeys = Array.isArray(target?.configKeys) ? target.configKeys.filter(Boolean) : [];

  if (!raw && !hint) {
    return { message: '', hint: '' };
  }

  if (/ENOTFOUND/i.test(raw)) {
    const unresolvedHost =
      extractDnsHostFromText(raw) ||
      (String(target?.endpoint || '').match(/^https?:\/\/([^/:]+)/i)?.[1] || '') ||
      'unknown-host';
    return {
      message: `DNS lookup failed for host "${unresolvedHost}".`,
      hint:
        hint ||
        'Service host name may be wrong or missing from Docker network DNS. Verify container name/network alias and URL.',
    };
  }

  const refusedMatch = raw.match(/ECONNREFUSED\s+([^\s]+)/i);
  if (refusedMatch) {
    return {
      message: `Connection refused by ${refusedMatch[1]}.`,
      hint: hint || 'Verify service is running and port mapping is correct.',
    };
  }

  if (/(ETIMEDOUT|ECONNABORTED)/i.test(raw)) {
    return {
      message: 'Connection timed out.',
      hint: hint || 'Service is reachable but did not respond in time.',
    };
  }

  if (/Service URL is not configured/i.test(raw)) {
    return {
      message: 'Service URL is not configured.',
      hint: hint || (configKeys.length > 0 ? `Set: ${configKeys.join(', ')}` : ''),
    };
  }

  if (/HTTP\s+\d+/i.test(raw)) {
    return {
      message: `${target?.displayName || 'Service'} returned ${raw}.`,
      hint,
    };
  }

  return {
    message: raw,
    hint: hint || (configKeys.length > 0 && /not configured/i.test(raw) ? `Set: ${configKeys.join(', ')}` : ''),
  };
};

/**
 * Flattens all monitored entities into one list (services + API Gate dependencies).
 */
const collectMonitoredTargets = (services = []) => {
  const flattened = [];
  services.forEach((service) => {
    flattened.push(service);
    if (Array.isArray(service?.dependencies)) {
      service.dependencies.forEach((dependency) => flattened.push(dependency));
    }
  });
  return flattened;
};

/**
 * Aggregates dependency state counters for API Gate's dependency header chips.
 */
const summarizeDependencies = (dependencies = []) =>
  dependencies.reduce(
    (accumulator, dependency) => {
      const severity = getSeverityLevel(dependency?.status, dependency?.connectionStatus);
      if (severity === 0) accumulator.up += 1;
      else if (severity === 1) accumulator.degraded += 1;
      else accumulator.down += 1;
      return accumulator;
    },
    { up: 0, degraded: 0, down: 0 },
  );

/**
 * Hides duplicate service-level errors when the same fetch-level error is already shown globally.
 */
const isDuplicateGlobalError = (serviceError, globalError, globalErrorHint) =>
  Boolean(globalError) &&
  String(serviceError?.message || '').trim() === String(globalError || '').trim() &&
  (!globalErrorHint ||
    String(serviceError?.hint || '').trim() === String(globalErrorHint || '').trim());

/**
 * Builds the metric strip values from the currently rendered health entities.
 */
const summarizeDashboardHealth = (services = []) => {
  const monitoredTargets = collectMonitoredTargets(services);
  if (monitoredTargets.length === 0) {
    return DEFAULT_HEALTH_SUMMARY;
  }

  const counts = {
    monitored: monitoredTargets.length,
    healthy: 0,
    degraded: 0,
    down: 0,
  };

  const latencyValues = [];
  monitoredTargets.forEach((target) => {
    const severity = getSeverityLevel(target?.status, target?.connectionStatus);
    if (severity === 0) counts.healthy += 1;
    else if (severity === 1) counts.degraded += 1;
    else counts.down += 1;

    if (typeof target?.responseTimeMs === 'number') {
      latencyValues.push(Math.max(0, Number(target.responseTimeMs) || 0));
    }
  });

  const avgLatency =
    latencyValues.length > 0
      ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
      : null;

  return {
    ...counts,
    avgLatency,
  };
};

const ServiceConnectionsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const [healthPayload, setHealthPayload] = useState(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(AUTO_REFRESH_SECONDS);
  const [highlightedKeys, setHighlightedKeys] = useState([]);
  const previousStatusRef = useRef({});
  const highlightTimeoutRef = useRef(null);

  const fetchHealth = useCallback(async (silent = false) => {
    if (silent) {
      setIsBackgroundRefreshing(true);
    } else {
      setLoading(true);
      setError('');
      setErrorHint('');
    }
    try {
      const payload = await getServiceConnectionsHealth();
      setHealthPayload(payload);
      setError('');
      setErrorHint('');
    } catch (err) {
      const normalizedError = normalizeHealthFetchError(err);
      setError(normalizedError.message);
      setErrorHint(normalizedError.hint || '');
      setHealthPayload((previousPayload) =>
        createApiGateUnavailablePayload(normalizedError, previousPayload),
      );
    } finally {
      if (silent) {
        setIsBackgroundRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchHealth(false);
    setSecondsUntilRefresh(AUTO_REFRESH_SECONDS);

    const pollIntervalId = window.setInterval(() => {
      setSecondsUntilRefresh(AUTO_REFRESH_SECONDS);
      void fetchHealth(true);
    }, AUTO_REFRESH_MS);

    const countdownIntervalId = window.setInterval(() => {
      setSecondsUntilRefresh((previous) => (previous <= 1 ? AUTO_REFRESH_SECONDS : previous - 1));
    }, 1000);

    return () => {
      window.clearInterval(pollIntervalId);
      window.clearInterval(countdownIntervalId);
    };
  }, [fetchHealth]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const services = useMemo(() => {
    if (!Array.isArray(healthPayload?.services)) return [];
    return sortServicesWithApiGateFirst(healthPayload.services);
  }, [healthPayload]);

  useEffect(() => {
    if (services.length === 0) return;

    const nextStatusMap = {};
    const changedKeys = [];

    services.forEach((service) => {
      const serviceKey = `service:${service?.key || service?.displayName}`;
      const serviceStatus = `${service?.status || ''}|${service?.connectionStatus || ''}`;
      nextStatusMap[serviceKey] = serviceStatus;
      if (
        previousStatusRef.current[serviceKey] &&
        previousStatusRef.current[serviceKey] !== serviceStatus
      ) {
        changedKeys.push(serviceKey);
      }

      if (Array.isArray(service?.dependencies)) {
        service.dependencies.forEach((dependency) => {
          const dependencyKey = `dependency:${service?.key || 'service'}:${dependency?.key || dependency?.displayName}`;
          const dependencyStatus = `${dependency?.status || ''}|${dependency?.connectionStatus || ''}`;
          nextStatusMap[dependencyKey] = dependencyStatus;
          if (
            previousStatusRef.current[dependencyKey] &&
            previousStatusRef.current[dependencyKey] !== dependencyStatus
          ) {
            changedKeys.push(dependencyKey);
          }
        });
      }
    });

    previousStatusRef.current = nextStatusMap;

    if (changedKeys.length > 0) {
      setHighlightedKeys(changedKeys);
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedKeys([]);
      }, STATUS_HIGHLIGHT_MS);
    }
  }, [services]);

  const highlightedSet = useMemo(() => new Set(highlightedKeys), [highlightedKeys]);

  const summary = useMemo(() => {
    return summarizeDashboardHealth(services);
  }, [services]);

  const overallMeta = getStatusMeta(healthPayload?.status, healthPayload?.connectionStatus);

  const handleManualRefresh = () => {
    setSecondsUntilRefresh(AUTO_REFRESH_SECONDS);
    void fetchHealth(false);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        background: DASHBOARD_BACKGROUND,
      }}
    >
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
            <Typography variant='h5' component='h2' sx={{ fontWeight: 700 }}>
              Service Connection Dashboard
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Live status for core services, plus API Gate dependency health.
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              API Gate is highlighted as the primary mediator for all downstream traffic.
            </Typography>
          </Box>
          <Stack direction='row' spacing={1} alignItems='center'>
            <Chip
              size='small'
              label={`Overall: ${overallMeta.label.toLowerCase()}`}
              color={overallMeta.color}
              icon={overallMeta.icon}
              variant='filled'
            />
            <Button
              size='small'
              variant='outlined'
              startIcon={<RefreshIcon />}
              onClick={handleManualRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
            gap: 1.2,
          }}
        >
          <Paper variant='outlined' sx={{ p: 1.2 }}>
            <Typography variant='caption' color='text.secondary'>
              Monitored
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 700 }}>
              {summary.monitored}
            </Typography>
          </Paper>
          <Paper variant='outlined' sx={{ p: 1.2 }}>
            <Typography variant='caption' color='text.secondary'>
              Healthy
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 700, color: 'success.main' }}>
              {summary.healthy}
            </Typography>
          </Paper>
          <Paper variant='outlined' sx={{ p: 1.2 }}>
            <Typography variant='caption' color='text.secondary'>
              Degraded
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 700, color: 'warning.main' }}>
              {summary.degraded}
            </Typography>
          </Paper>
          <Paper variant='outlined' sx={{ p: 1.2 }}>
            <Typography variant='caption' color='text.secondary'>
              Down
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 700, color: 'error.main' }}>
              {summary.down}
            </Typography>
          </Paper>
          <Paper variant='outlined' sx={{ p: 1.2 }}>
            <Typography variant='caption' color='text.secondary'>
              Avg Response
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 700 }}>
              {summary.avgLatency === null ? '-' : `${summary.avgLatency} ms`}
            </Typography>
          </Paper>
          <Paper variant='outlined' sx={{ p: 1.2 }}>
            <Typography variant='caption' color='text.secondary'>
              Next Check
            </Typography>
            <Stack direction='row' spacing={0.75} alignItems='center'>
              <AccessTimeRoundedIcon fontSize='small' color='action' />
              <Typography variant='h6' sx={{ fontWeight: 700 }}>
                {formatCountdown(secondsUntilRefresh)}
              </Typography>
              {isBackgroundRefreshing ? (
                <CircularProgress size={14} thickness={6} />
              ) : (
                <AutorenewRoundedIcon fontSize='small' color='disabled' />
              )}
            </Stack>
          </Paper>
        </Box>

        <Typography variant='caption' color='text.secondary'>
          Last check: {formatDateTime(healthPayload?.checkedAt)}
        </Typography>

        <Divider sx={{ borderColor: (theme) => theme.palette.divider }} />

        {loading && services.length === 0 ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}

        {error ? (
          <Alert severity='error'>
            <Typography variant='body2'>{error}</Typography>
            {errorHint ? (
              <Typography variant='caption' sx={{ display: 'block', mt: 0.3 }}>
                {errorHint}
              </Typography>
            ) : null}
          </Alert>
        ) : null}

        {services.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {services.map((service) => {
              const isApiGate = service?.key === 'api-gate';
              const serviceStatus = getStatusMeta(service?.status, service?.connectionStatus);
              const serviceCardKey = `service:${service?.key || service?.displayName}`;
              const serviceError = normalizeErrorDetails(service);
              const shouldHideServiceAlert =
                isApiGate &&
                isDuplicateGlobalError(serviceError, error, errorHint);
              const dependencySummary =
                isApiGate && Array.isArray(service?.dependencies)
                  ? summarizeDependencies(service.dependencies)
                  : null;

              return (
                <Paper
                  key={service?.key || service?.displayName}
                  variant='outlined'
                  sx={{
                    p: isApiGate ? { xs: 2, md: 2.4 } : 2,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.2,
                    minHeight: 210,
                    gridColumn: isApiGate ? { xs: 'auto', md: '1 / -1' } : 'auto',
                    background: isApiGate ? PRIMARY_SERVICE_BACKGROUND : undefined,
                    borderColor: highlightedSet.has(serviceCardKey) ? 'warning.main' : 'divider',
                    boxShadow: highlightedSet.has(serviceCardKey)
                      ? '0 0 0 2px rgba(245, 158, 11, 0.28)'
                      : 'none',
                    animation: highlightedSet.has(serviceCardKey)
                      ? 'statusPulse 1.1s ease-in-out 2'
                      : 'none',
                    '@keyframes statusPulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.0)' },
                      '50%': { boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.3)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.0)' },
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    <Box>
                      <Typography variant='h6' sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {service?.displayName || service?.key || 'Service'}
                      </Typography>
                      {isApiGate ? (
                        <Chip
                          size='small'
                          label='Primary Mediator'
                          color='info'
                          variant='outlined'
                          sx={{ mt: 0.6, fontWeight: 600 }}
                        />
                      ) : null}
                      {highlightedSet.has(serviceCardKey) ? (
                        <Typography variant='caption' color='warning.main' sx={{ fontWeight: 600 }}>
                          Status changed recently
                        </Typography>
                      ) : null}
                    </Box>
                    <Chip
                      size='small'
                      icon={serviceStatus.icon}
                      label={serviceStatus.label}
                      color={serviceStatus.color}
                    />
                  </Box>

                  <Typography variant='body2'>
                    <strong>Version:</strong> {String(service?.version || 'unknown')}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>Status:</strong> {String(service?.status || 'unknown')}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>Checked:</strong> {formatDateTime(service?.checkedAt)}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>Response:</strong> {formatLatency(service?.responseTimeMs)}
                  </Typography>

                  {service?.key === 'api-gate' &&
                  Array.isArray(service?.dependencies) &&
                  service.dependencies.length > 0 ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1.1,
                        borderRadius: 1.5,
                        backgroundColor: 'rgba(15, 23, 42, 0.03)',
                        border: '1px solid rgba(15, 23, 42, 0.06)',
                      }}
                    >
                      <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                        API Gate Dependencies
                      </Typography>
                      {dependencySummary ? (
                        <Stack direction='row' spacing={1} sx={{ mb: 1 }}>
                          <Chip size='small' label={`Up: ${dependencySummary.up}`} color='success' variant='outlined' />
                          <Chip
                            size='small'
                            label={`Degraded: ${dependencySummary.degraded}`}
                            color='warning'
                            variant='outlined'
                          />
                          <Chip size='small' label={`Down: ${dependencySummary.down}`} color='error' variant='outlined' />
                        </Stack>
                      ) : null}

                      <Box
                        sx={{
                          display: { xs: 'none', md: 'grid' },
                          gridTemplateColumns: DEPENDENCY_GRID_TEMPLATE,
                          gap: 1,
                          px: 0.8,
                          pb: 0.5,
                          minWidth: 0,
                        }}
                      >
                        <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700 }}>
                          Name
                        </Typography>
                        <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700 }}>
                          Status
                        </Typography>
                        <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700 }}>
                          Latency
                        </Typography>
                        <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700 }}>
                          Error
                        </Typography>
                      </Box>

                      <Stack spacing={0.75}>
                        {service.dependencies.map((dependency) => {
                          const dependencyStatus = getStatusMeta(
                            dependency?.status,
                            dependency?.connectionStatus,
                          );
                          const dependencyKey = `dependency:${service?.key || 'service'}:${dependency?.key || dependency?.displayName}`;
                          const dependencyError = normalizeErrorDetails(dependency);

                          return (
                            <Box
                              key={dependency?.key || dependency?.displayName}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                backgroundColor: highlightedSet.has(dependencyKey)
                                  ? 'rgba(245, 158, 11, 0.14)'
                                  : 'rgba(255, 255, 255, 0.72)',
                                border: highlightedSet.has(dependencyKey)
                                  ? '1px solid rgba(245, 158, 11, 0.45)'
                                  : '1px solid rgba(15, 23, 42, 0.06)',
                                display: 'grid',
                                gridTemplateColumns: {
                                  xs: '1fr',
                                  md: DEPENDENCY_GRID_TEMPLATE,
                                },
                                gap: 1,
                                minWidth: 0,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant='body2' sx={{ fontWeight: 700 }}>
                                  {String(dependency?.displayName || dependency?.key || 'Dependency')}
                                </Typography>
                                <Typography variant='caption' color='text.secondary' sx={{ display: { md: 'none' } }}>
                                  Status / Latency / Error
                                </Typography>
                              </Box>

                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Chip
                                  size='small'
                                  icon={dependencyStatus.icon}
                                  label={dependencyStatus.label}
                                  color={dependencyStatus.color}
                                />
                              </Box>

                              <Typography variant='body2'>{formatLatency(dependency?.responseTimeMs)}</Typography>

                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  variant='body2'
                                  color={dependencyError.message ? 'warning.main' : 'text.secondary'}
                                  sx={{
                                    whiteSpace: 'normal',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {dependencyError.message || '-'}
                                </Typography>
                                {dependencyError.hint ? (
                                  <Typography
                                    variant='caption'
                                    color='text.secondary'
                                    sx={{
                                      display: 'block',
                                      mt: 0.2,
                                      whiteSpace: 'normal',
                                      overflowWrap: 'anywhere',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {dependencyError.hint}
                                  </Typography>
                                ) : null}
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  ) : null}

                  {service?.packages?.dataProvider || service?.packages?.dgSkinsPackage ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1.2,
                        borderRadius: 1.5,
                        backgroundColor: 'rgba(15, 23, 42, 0.03)',
                      }}
                    >
                      <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.4 }}>
                        Content Control Package Versions
                      </Typography>
                      <Typography variant='body2'>
                        Data Provider: {String(service?.packages?.dataProvider?.version || 'unknown')}
                      </Typography>
                      <Typography variant='body2'>
                        DG Skins: {String(service?.packages?.dgSkinsPackage?.version || 'unknown')}
                      </Typography>
                    </Box>
                  ) : null}

                  {serviceError.message && !shouldHideServiceAlert ? (
                    <Alert severity={serviceStatus.severity === 2 ? 'error' : 'warning'} sx={{ mt: 'auto' }}>
                      <Typography variant='body2'>{serviceError.message}</Typography>
                      {serviceError.hint ? (
                        <Typography variant='caption' sx={{ display: 'block', mt: 0.25 }}>
                          {serviceError.hint}
                        </Typography>
                      ) : null}
                    </Alert>
                  ) : null}
                </Paper>
              );
            })}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default ServiceConnectionsDashboard;
