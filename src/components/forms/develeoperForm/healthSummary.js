// Extracted from ServiceConnectionsDashboard.jsx (same precedent as serviceVersions.js) so the
// Monitoring tab can derive its one-sentence health summary from the same severity model
// without duplicating it or re-rendering the health strip itself.
export const DEFAULT_HEALTH_SUMMARY = Object.freeze({
  monitored: 0,
  healthy: 0,
  degraded: 0,
  down: 0,
  avgLatency: null,
});

/**
 * Converts service status and connection state into a sortable severity number.
 * Higher numbers indicate a more severe state.
 */
export const getSeverityLevel = (status, connectionStatus) => {
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
 * Flattens all monitored entities into one list (services + nested dependencies).
 */
export const collectMonitoredTargets = (services = []) => {
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
 * Builds the metric strip values from the currently rendered health entities.
 */
export const summarizeDashboardHealth = (services = []) => {
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
