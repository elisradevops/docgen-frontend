import { useEffect, useRef, useState } from 'react';
import { getDiagnosticsEvents } from '../../../store/data/docManagerApi';
import logger from '../../../utils/logger';
import { advanceLiveBoundary, aggregateRefreshDelay, buildEventQueryParams, LIVE_PAGE_LIMIT, LIVE_POLL_MS } from './logsExplorerState';
import { advanceTail, buildTailParams, initialTailState, shouldResync } from './liveTailState';

// The Logs live tail: polls api-gate while `enabled`, hands new rows to the page, and drains a burst larger
// than one page over back-to-back polls (the decisions live in liveTailState.js and are tested there).
//
// It asks for what was INSERTED since the last poll, by arrival and not by the event's own `ts`: events reach
// the store late and out of order (every service buffers and flushes on its own), so a `ts` boundary skipped
// a slow service's older events for good. The boundary is seeded from the SERVER's clock, never the browser's.
//
// The page supplies (all read at call time, so changing them never restarts the tail):
//   seedBoundary()                 -> ms to start from (the last full load's server time, else the newest row)
//   onEvents(events)               -> merge the rows into the table
//   refreshAggregates({ isCancelled }) -> re-fetch the chart and facet counts (throttled here)
//   onResync()                     -> reload the newest page (after a long time in a hidden tab); returns a promise
// plus the refs the throttle shares with the page: aggregatesRefreshedAtRef and bucketSelectedRef.
// Returns what the status chips show: hidden, failures, lastOkAt, behind, overflow.
export const useLiveTail = ({
  enabled,
  queryState,
  seedBoundary,
  onEvents,
  refreshAggregates,
  onResync,
  aggregatesRefreshedAtRef,
  bucketSelectedRef,
}) => {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [failures, setFailures] = useState(0);
  const [lastOkAt, setLastOkAt] = useState(undefined);
  const [behind, setBehind] = useState(0);
  // Only an api-gate without tail mode produces this (the old "+N more events" signal).
  const [overflow, setOverflow] = useState(0);

  const latest = useRef({});
  latest.current = { seedBoundary, onEvents, refreshAggregates, onResync };

  useEffect(() => {
    if (!enabled) return undefined;
    // Set by the cleanup: a poll still awaiting its response when the filters change (or Live is switched
    // off) must not merge its now-stale rows into the table.
    let cancelled = false;
    let tickInFlight = false;
    let tailState = initialTailState();
    let drainTimer = null;
    let aggregateTimer = null;
    let failureStreak = 0;
    let resyncing = false;
    // When the tab became hidden (null while visible): a long absence reloads the page on return.
    let hiddenSince = typeof document !== 'undefined' && document.hidden ? Date.now() : null;
    let boundaryMs = latest.current.seedBoundary();
    setFailures(0);

    // The poll only merges rows into the table; the chart and the facet counts come from their own queries.
    // They are re-fetched on a throttle when rows arrive (see aggregateRefreshDelay), reading the current state
    // when the timer fires so a burst is covered by one refresh.
    const runAggregateRefresh = async () => {
      aggregateTimer = null;
      if (cancelled || bucketSelectedRef.current) return;
      aggregatesRefreshedAtRef.current = Date.now();
      await latest.current.refreshAggregates({ isCancelled: () => cancelled });
    };
    const scheduleAggregateRefresh = (newRows) => {
      const delay = aggregateRefreshDelay({
        newRows,
        lastRefreshAt: aggregatesRefreshedAtRef.current,
        now: Date.now(),
        pending: aggregateTimer !== null,
        paused: bucketSelectedRef.current,
      });
      if (delay !== null) aggregateTimer = window.setTimeout(runAggregateRefresh, delay);
    };

    const tick = async () => {
      if (cancelled || tickInFlight || resyncing || document.hidden) return;
      tickInFlight = true;
      let drainNext = false;
      try {
        const params = buildEventQueryParams(queryState);
        if (queryState.runId) params.runId = queryState.runId;
        delete params.until; // live tail only ever looks forward, never has an upper bound
        params.limit = LIVE_PAGE_LIMIT;
        params.includeCount = true;
        const hadBoundary = Number.isFinite(boundaryMs);
        Object.assign(params, buildTailParams(tailState, boundaryMs));
        const res = await getDiagnosticsEvents(params);
        if (cancelled) return;
        const next = advanceTail(tailState, res, { hadBoundary });
        tailState = next.state;
        drainNext = next.drainNext;
        boundaryMs = advanceLiveBoundary(boundaryMs, res.events, Date.parse(res.serverTime));
        latest.current.onEvents(res.events || []);
        setBehind(next.behind);
        setOverflow(next.overflow);
        failureStreak = 0;
        setFailures(0);
        setLastOkAt(Date.now());
        scheduleAggregateRefresh(res.events?.length ?? 0);
      } catch (err) {
        // One missed poll is normal and the next tick retries; a run of them is shown in the status chip. The
        // first of a run is logged (the message only), so a persistent problem leaves a trace without a line
        // every two seconds.
        if (!cancelled) {
          if (failureStreak === 0) logger.warn(`Logs live tail: poll failed (${err?.message ?? 'unknown error'})`);
          failureStreak += 1;
          setFailures((n) => n + 1);
        }
      } finally {
        tickInFlight = false;
        if (drainNext && !cancelled) drainTimer = window.setTimeout(tick, 0);
      }
    };

    const intervalId = window.setInterval(tick, LIVE_POLL_MS);
    tick(); // don't make the first look wait a full interval
    // After a long absence the missed events can far exceed the table, so draining them oldest first would crawl:
    // reload the newest page and start the tail again from its server time.
    const resync = async () => {
      resyncing = true;
      tailState = initialTailState();
      try {
        await latest.current.onResync();
      } finally {
        resyncing = false;
      }
      if (cancelled) return;
      boundaryMs = latest.current.seedBoundary();
      tick();
    };
    // Coming back to a hidden tab: catch up straight away instead of at the next interval.
    const onVisibility = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        hiddenSince = hiddenSince ?? Date.now();
        return;
      }
      const since = hiddenSince;
      hiddenSince = null;
      if (shouldResync(since, Date.now())) resync();
      else tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
      if (aggregateTimer !== null) window.clearTimeout(aggregateTimer);
      if (drainTimer !== null) window.clearTimeout(drainTimer);
      setOverflow(0);
      setBehind(0);
    };
    // The callbacks come through `latest`; the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, queryState]);

  return { hidden, failures, lastOkAt, behind, overflow };
};
