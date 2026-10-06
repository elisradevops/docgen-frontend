import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { FilterOutlined } from '@ant-design/icons';
import { Table, Button as AntButton, Select as AntSelect, Input, Checkbox, Space } from 'antd';
import LoadingState from '../../common/LoadingState';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import { levelColors as LEVEL_COLOR } from '../../../theme/tokens';
import {
  getDiagnosticsEvents,
  getDiagnosticsEventFacets,
  getDiagnosticsEventHistogram,
} from '../../../store/data/docManagerApi';
import {
  buildEventQueryParams,
  mergeLiveRows,
  logsBodyHeight,
  LOGS_SCROLLBAR_GUTTER_PX,
  formatRequestLine,
  buildDetailsText,
  buildLogsCsv,
  appendOlderEvents,
  hasReachedRowCap,
  canLiveTail,
  isRequestId,
  advanceLiveBoundary,
  formatStepLine,
  isCorrelationOnlyId,
  formatRunCellLabel,
  runCellActions,
  TIME_SORT_DIRECTIONS,
  sortStateFromSorter,
  LOG_ROW_CAP,
  buildHistogramBars,
  formatBucketRangeLabel,
  filterFacetValues,
} from './logsExplorerState';
import {
  loadLiveEnabled,
  saveLiveEnabled,
  loadLogsFilterSettings,
  isEventExcluded,
} from './logsFilterSettings';
import LogsFilterSettingsDialog from './LogsFilterSettingsDialog';
import LiveStatus from './LiveStatus';
import { useLiveTail } from './useLiveTail';
import VirtualLogBody from './VirtualLogBody';
import { useViewportHeight } from './useViewportHeight';

const WINDOW_OPTIONS = [
  { label: 'Last hour', value: 1 },
  { label: 'Last 24 hours', value: 24 },
  { label: 'Last 7 days', value: 168 },
  { label: 'Last 30 days', value: 720 },
];
const MESSAGE_TRUNCATE_LENGTH = 140;

const FACET_DIMENSIONS = ['level', 'service', 'project', 'docType'];

// Histogram — light-mode precision layout.
// Hover: dims all other bars so the active bucket reads clearly.
// Click: selects a bucket (toggles); selected bar is highlighted, others dimmed.
// selectedIdx is lifted to the parent so it can drive the table filter.
function HistogramSVG({ bars, bucketMs, selectedIdx, onBarClick }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hoveredBar, setHoveredBar] = useState(null);

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

  const CHART_H = 108;
  const BORDER_R = 6;   // app shape.borderRadiusSm token
  const BAR_GAP = 2;
  const BAR_TOP_R = 2;  // rounded top corners only — achieved via clipPath

  const n = bars.length || 1;
  const slotW = width / n;
  const barW = Math.max(1, slotW - BAR_GAP);

  return (
    <Box ref={containerRef} sx={{ width: '100%', borderRadius: `${BORDER_R}px`, overflow: 'hidden', border: '1px solid rgba(27,69,143,0.12)', bgcolor: 'rgba(248,250,252,0.6)' }}>
      <svg width={width} height={CHART_H} style={{ display: 'block' }}>
        {width > 0 && (
          <>
            <defs>
              {/* Per-bar clip paths: extends 4px below floor so only top corners are rounded. */}
              {bars.map((_, bi) => {
                const x = bi * slotW + BAR_GAP / 2;
                return (
                  <clipPath key={bi} id={`histo-clip-${bi}`}>
                    <rect x={x} y={0} width={barW} height={CHART_H + 4} rx={BAR_TOP_R} ry={BAR_TOP_R} />
                  </clipPath>
                );
              })}
            </defs>

            {/* 50% midline + solid baseline only — fewer lines, cleaner read at this height */}
            <line x1={0} y1={CHART_H * 0.5} x2={width} y2={CHART_H * 0.5} stroke='rgba(27,69,143,0.2)' strokeWidth={1} strokeDasharray='2,5' />
            <line x1={0} y1={CHART_H}       x2={width} y2={CHART_H}       stroke='rgba(27,69,143,0.32)' strokeWidth={1} />

            {bars.map((bar, bi) => {
              const x = bi * slotW + BAR_GAP / 2;
              const visibleSegs = bar.segments.filter((s) => s.count > 0);
              const isEmpty = visibleSegs.length === 0;
              let yOffset = CHART_H;

              // Dim bar when another bar is selected or hovered.
              const hasSelection = selectedIdx !== null;
              const hasHover = hoveredBar !== null;
              const isActive = bi === selectedIdx || bi === hoveredBar;
              const dimOpacity = isActive || (!hasSelection && !hasHover) ? 1 : 0.3;

              const barGroup = (
                <g
                  clipPath={`url(#histo-clip-${bi})`}
                  style={{ cursor: isEmpty ? 'default' : 'pointer', opacity: dimOpacity, transition: 'opacity 0.12s' }}
                  onClick={() => !isEmpty && onBarClick(bi, bar)}
                  onMouseEnter={() => !isEmpty && setHoveredBar(bi)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Transparent hit area — full slot height for reliable hover */}
                  <rect x={x} y={0} width={barW} height={CHART_H} fill='transparent' />

                  {visibleSegs.map((seg, si) => {
                    const h = Math.max(1, (seg.heightPct / 100) * CHART_H);
                    yOffset -= h;
                    const segY = yOffset;
                    return (
                      <g key={seg.level}>
                        <rect x={x} y={segY} width={barW} height={h} fill={LEVEL_COLOR[seg.level]} />
                        {/* 1px white separator between stacked segments — separates similar hues */}
                        {si < visibleSegs.length - 1 && (
                          <line x1={x} y1={segY} x2={x + barW} y2={segY} stroke='white' strokeWidth={1} />
                        )}
                      </g>
                    );
                  })}

                  {/* Hover highlight */}
                  {hoveredBar === bi && selectedIdx !== bi && (
                    <rect
                      x={x} y={0} width={barW} height={CHART_H}
                      fill='rgba(27,69,143,0.05)'
                      stroke='rgba(27,69,143,0.22)'
                      strokeWidth={1}
                      rx={2} ry={2}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* Selection highlight — solid blue outline */}
                  {selectedIdx === bi && (
                    <rect
                      x={x} y={0} width={barW} height={CHART_H}
                      fill='rgba(27,69,143,0.08)'
                      stroke='rgba(27,69,143,0.55)'
                      strokeWidth={1.5}
                      rx={2} ry={2}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );

              if (isEmpty) return <g key={bar.bucketStart}>{barGroup}</g>;

              return (
                <Tooltip
                  key={bar.bucketStart}
                  title={
                    <>
                      <div style={{ marginBottom: 3, opacity: 0.7, fontSize: 11 }}>
                        {formatBucketRangeLabel(bar.bucketStart, bucketMs)}
                      </div>
                      {visibleSegs.map((s) => (
                        <div key={s.level} style={{ fontSize: 12 }}>
                          <span style={{ color: LEVEL_COLOR[s.level], fontWeight: 600 }}>{s.count}</span>
                          {' '}{s.level}
                        </div>
                      ))}
                    </>
                  }
                  placement='top'
                >
                  {barGroup}
                </Tooltip>
              );
            })}
          </>
        )}
      </svg>
    </Box>
  );
}

function FacetFilterDropdown({ dimension, facetValues, selected, onChange, onClear }) {
  const [search, setSearch] = useState('');
  const visible = filterFacetValues(facetValues, search);
  return (
    <div style={{ padding: 8, width: 240 }} onKeyDown={(e) => e.stopPropagation()}>
      <Input
        placeholder={`Search ${dimension}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 8 }}
        allowClear
      />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <Typography variant='body2' color='text.secondary' sx={{ p: 1 }}>
            No matching values.
          </Typography>
        ) : (
          <Checkbox.Group
            value={selected}
            onChange={onChange}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {visible.map((f) => (
              <Checkbox key={f.value} value={f.value}>
                {f.value} <span style={{ color: '#94a3b8' }}>({f.count})</span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        )}
      </div>
      <Space style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <Button size='small' onClick={onClear}>
          Clear
        </Button>
      </Space>
    </div>
  );
}

const rowKeyOf = (record) => record._id;

// Memoized so a re-render of the page for an unrelated reason (a status chip, the Live flags) skips the
// table. antd keeps rendering the header (sort arrows, facet filters); the rows are a virtualized list, so
// only the ones near the viewport exist in the DOM however many events are loaded.
const LogsTable = React.memo(({ dataSource, columns, onChange }) => {
  const height = useViewportHeight(logsBodyHeight);
  const components = useMemo(
    () => ({ body: (rows) => <VirtualLogBody data={rows} columns={columns} height={height} /> }),
    [columns, height]
  );
  // Narrower than the columns need: the header and the rows scroll sideways together, never apart.
  const minWidth = useMemo(() => columns.reduce((sum, column) => sum + (column.width || 0), 0) + LOGS_SCROLLBAR_GUTTER_PX, [columns]);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth }}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey={rowKeyOf}
          pagination={false}
          onChange={onChange}
          size='small'
          scroll={{ y: height }}
          components={components}
        />
      </div>
    </div>
  );
});
LogsTable.displayName = 'LogsTable';

const LogsExplorer = ({ onOpenRun, initialRunId = '' }) => {
  const [filterSettings, setFilterSettings] = useState(loadLogsFilterSettings);
  const [windowHours, setWindowHours] = useState(() => loadLogsFilterSettings().defaultWindowHours);
  const [filters, setFilters] = useState(() => {
    const s = loadLogsFilterSettings();
    return { level: s.defaultLevels ?? [], service: s.defaultServices ?? [], project: [], docType: [] };
  });
  const [q, setQ] = useState('');
  const [runId, setRunId] = useState(initialRunId);
  const [sortBy, setSortBy] = useState('ts');
  const [sortDir, setSortDir] = useState('desc');

  const [events, setEvents] = useState([]);
  const [nextCursor, setNextCursor] = useState(undefined);
  const [facets, setFacets] = useState({ level: [], service: [], project: [], docType: [] });
  const [histogram, setHistogram] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [expandedStackId, setExpandedStackId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // On by default (remembered): a debugging session wants the tail running from the first screen.
  const [live, setLive] = useState(loadLiveEnabled);
  // Server clock (ms) at the last full load: where the live tail starts when nothing else anchors it.
  const serverTimeRef = useRef(null);
  // The rows currently shown, for the live tail's starting point (read at call time, never a dependency).
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const [selectedBucketIdx, setSelectedBucketIdx] = useState(null);
  // bucketFilter drives a server-side re-fetch for the clicked bucket's exact time range.
  // Kept separate from queryState so the histogram (full window) is never affected.
  const [bucketFilter, setBucketFilter] = useState(null); // { since, until, label } | null

  // Typing in the search / Run ID boxes shouldn't fire the events + facets + histogram queries on
  // every keystroke — the query follows the text once it has settled.
  const debouncedQ = useDebouncedValue(q, 300);
  const debouncedRunId = useDebouncedValue(runId, 300);
  const queryState = useMemo(
    () => ({ ...filters, q: debouncedQ, runId: debouncedRunId.trim() || undefined, windowHours, sortBy, sortDir }),
    [filters, debouncedQ, debouncedRunId, windowHours, sortBy, sortDir]
  );
  // Bumped by every load that replaces the table's rows; a response whose number is no longer
  // current (a newer filter change started another load meanwhile) is discarded rather than
  // overwriting newer state.
  const requestSeqRef = useRef(0);
  const [windowCapped, setWindowCapped] = useState(false);
  // When the chart and facet counts were last fetched (a full load or a live refresh), and whether a
  // histogram bar is selected: the live refresh waits its turn and leaves a selected bar's view alone.
  const aggregatesRefreshedAtRef = useRef(0);
  const bucketSelectedRef = useRef(false);
  bucketSelectedRef.current = selectedBucketIdx !== null || bucketFilter !== null;

  const loadFirstPage = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError('');
    try {
      const params = buildEventQueryParams(queryState);
      if (queryState.runId) params.runId = queryState.runId;
      const [eventsRes, facetsRes, histogramRes] = await Promise.all([
        getDiagnosticsEvents(params),
        getDiagnosticsEventFacets(params),
        getDiagnosticsEventHistogram(params),
      ]);
      if (seq !== requestSeqRef.current) return;
      setEvents(eventsRes.events || []);
      setNextCursor(eventsRes.nextCursor);
      setWindowCapped(!!eventsRes.windowCapped);
      const serverMs = Date.parse(eventsRes.serverTime);
      serverTimeRef.current = Number.isFinite(serverMs) ? serverMs : null;
      setFacets(facetsRes.facets || { level: [], service: [], project: [], docType: [] });
      setHistogram(histogramRes.buckets || []);
      aggregatesRefreshedAtRef.current = Date.now();
      setSelectedBucketIdx(null);
      setBucketFilter(null);
    } catch (err) {
      if (seq === requestSeqRef.current) setError(err.message || 'Failed to load logs.');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [queryState]);

  // Fetches events for a specific bucket time range without touching the histogram.
  const loadBucketEvents = useCallback(async (since, until) => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError('');
    try {
      const params = buildEventQueryParams({ ...queryState, since, until });
      if (queryState.runId) params.runId = queryState.runId;
      const eventsRes = await getDiagnosticsEvents(params);
      if (seq !== requestSeqRef.current) return;
      setEvents(eventsRes.events || []);
      setNextCursor(eventsRes.nextCursor);
    } catch (err) {
      if (seq === requestSeqRef.current) setError(err.message || 'Failed to load bucket events.');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // The chart and facet counts are re-fetched while Live brings rows (the hook throttles it). A response is
  // dropped if a full load started meanwhile, and a failed refresh just keeps what is on screen.
  const refreshAggregates = async ({ isCancelled }) => {
    const seq = requestSeqRef.current;
    try {
      const params = buildEventQueryParams(queryState);
      if (queryState.runId) params.runId = queryState.runId;
      const [facetsRes, histogramRes] = await Promise.all([
        getDiagnosticsEventFacets(params),
        getDiagnosticsEventHistogram(params),
      ]);
      if (isCancelled() || seq !== requestSeqRef.current || bucketSelectedRef.current) return;
      setFacets(facetsRes.facets || { level: [], service: [], project: [], docType: [] });
      setHistogram(histogramRes.buckets || []);
    } catch {
      // Keep the current chart; the next poll with new rows tries again.
    }
  };

  // Live tail (see useLiveTail): new rows join the table, merged by id and kept in time order.
  const {
    hidden: liveHidden,
    failures: liveFailures,
    lastOkAt: liveLastOkAt,
    behind: liveBehind,
    overflow: liveOverflow,
  } = useLiveTail({
    enabled: live && canLiveTail(sortBy, sortDir),
    queryState,
    seedBoundary: () =>
      Number.isFinite(serverTimeRef.current) ? serverTimeRef.current : advanceLiveBoundary(null, eventsRef.current, undefined),
    onEvents: (rows) => setEvents((prev) => mergeLiveRows(prev, rows)),
    refreshAggregates,
    aggregatesRefreshedAtRef,
    bucketSelectedRef,
  });

  const loadOlder = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = buildEventQueryParams(queryState);
      if (queryState.runId) params.runId = queryState.runId;
      params.cursor = nextCursor;
      const res = await getDiagnosticsEvents(params);
      setEvents((prev) => appendOlderEvents(prev, res.events || [], { maxTotal: LOG_ROW_CAP }));
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err.message || 'Failed to load older events.');
    } finally {
      setLoadingMore(false);
    }
  };

  const histogramBars = useMemo(() => buildHistogramBars(histogram), [histogram]);
  const bucketMs = histogram.length >= 2 ? new Date(histogram[1].bucketStart) - new Date(histogram[0].bucketStart) : 0;

  // Client-side exclude only — bucket time filtering is now server-side (loadBucketEvents).
  const filteredEvents = useMemo(
    () => events.filter((e) => !isEventExcluded(e, filterSettings.excludePhrases)),
    [events, filterSettings.excludePhrases]
  );

  const columns = useMemo(() => {
  const facetColumn = (dimension, title, width) => ({
    title,
    dataIndex: dimension,
    key: dimension,
    width,
    filteredValue: filters[dimension]?.length ? filters[dimension] : null,
    filterDropdown: ({ confirm, clearFilters }) => (
      <FacetFilterDropdown
        dimension={dimension}
        facetValues={facets[dimension] || []}
        selected={filters[dimension]}
        onChange={(vals) => setFilters((prev) => ({ ...prev, [dimension]: vals }))}
        onClear={() => {
          setFilters((prev) => ({ ...prev, [dimension]: [] }));
          clearFilters?.();
          confirm();
        }}
      />
    ),
  });

  const definitions = [
    {
      title: 'Time',
      dataIndex: 'ts',
      key: 'ts',
      width: 170,
      sorter: true,
      sortDirections: TIME_SORT_DIRECTIONS,
      sortOrder: sortBy === 'ts' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      render: (ts) => new Date(ts).toLocaleString(),
    },
    {
      ...facetColumn('level', 'Level', 90),
      sorter: true,
      sortOrder: sortBy === 'level' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      render: (level) => <span style={{ color: LEVEL_COLOR[level], fontWeight: 700 }}>{String(level).toUpperCase()}</span>,
    },
    { ...facetColumn('service', 'Service', 160), sorter: true, sortOrder: sortBy === 'service' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null },
    {
      ...facetColumn('project', 'Project', 130),
      render: (project, record) => {
        if (project) return project;
        if (!record.runId) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>System</span>;
        return <span style={{ color: '#cbd5e1' }}>—</span>;
      },
    },
    facetColumn('docType', 'Type', 90),
    {
      title: 'Run',
      dataIndex: 'runId',
      key: 'runId',
      width: 150,
      render: (id) => {
        if (!id) return null;
        const actions = runCellActions(id, typeof onOpenRun === 'function');
        const filterTitle = isRequestId(id)
          ? 'A request id, not a document run — filter to this request'
          : isCorrelationOnlyId(id)
            ? 'A working session, not a document run — filter to this session'
            : 'Show only this run';
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
            {/* A real run: the id opens its detail (the primary thing anyone wants from it) and a
                separate icon narrows the table. A request/session id has no run page, so it filters. */}
            <AntButton
              type='link'
              size='small'
              style={{ padding: 0, fontFamily: 'monospace' }}
              onClick={() => (actions.primary === 'open' ? onOpenRun(id) : setRunId(id))}
              title={actions.primary === 'open' ? 'Open run detail' : filterTitle}
              aria-label={actions.primary === 'open' ? 'Open run detail' : filterTitle}
            >
              {formatRunCellLabel(id)}
            </AntButton>
            {actions.showFilterIcon ? (
              <AntButton
                type='text'
                size='small'
                icon={<FilterOutlined />}
                style={{ color: '#64748b' }}
                onClick={() => setRunId(id)}
                title='Show only this run'
                aria-label='Show only this run'
              />
            ) : null}
          </span>
        );
      },
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      // Every column has an explicit width: the header (fixed layout) and the virtual rows below it
      // stay aligned by growing in proportion to these.
      width: 520,
      render: (message, record) => {
        const isExpanded = expandedRowId === record._id;
        const isLong = (message || '').length > MESSAGE_TRUNCATE_LENGTH;
        const requestLine = formatRequestLine(record.context);
        const stepLine = formatStepLine(record);
        const hasStack = !!record.err?.stack || !!requestLine;
        const isStackExpanded = expandedStackId === record._id;
        return (
          <div>
            <div style={{ whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: 'ellipsis' }}>
              {isExpanded || !isLong ? message : `${message.slice(0, MESSAGE_TRUNCATE_LENGTH)}…`}
              {isLong ? (
                <AntButton
                  type='link'
                  size='small'
                  style={{ padding: '0 0 0 8px' }}
                  onClick={() => setExpandedRowId(isExpanded ? null : record._id)}
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </AntButton>
              ) : null}
            </div>
            {stepLine ? <div style={{ fontSize: 11, color: '#64748b' }}>{stepLine}</div> : null}
            {requestLine ? (
              <div style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all' }}>{requestLine}</div>
            ) : null}
            {hasStack ? (
              <div>
                <AntButton
                  type='link'
                  size='small'
                  style={{ padding: 0, fontSize: 11 }}
                  onClick={() => setExpandedStackId(isStackExpanded ? null : record._id)}
                >
                  {`${requestLine ? 'Details' : 'Stack'} ${isStackExpanded ? '▴' : '▾'}`}
                </AntButton>
                {isStackExpanded ? (
                  <pre
                    style={{
                      margin: '4px 0 0',
                      fontSize: 11,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: '#94a3b8',
                      background: 'rgba(0,0,0,0.04)',
                      padding: '8px',
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {buildDetailsText(record)}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];
  return definitions;
  // setRunId, setFilters, setExpanded* and the sort setters are stable; the rest decide the columns' output.
  }, [filters, facets, sortBy, sortDir, expandedRowId, expandedStackId, onOpenRun]);

  const handleTableChange = useCallback((_pagination, _tableFilters, sorter) => {
    const next = sortStateFromSorter(sorter);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  }, []);

  const grandTotal = histogramBars.reduce((sum, b) => sum + b.total, 0);

  const exportCsv = () => {
    const csv = buildLogsCsv(events);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2}>
      <Stack useFlexGap direction='row' spacing={1.5} flexWrap='wrap' alignItems='center'>
        <Input.Search
          placeholder='Search message text…'
          allowClear
          style={{ width: 260 }}
          defaultValue={q}
          onSearch={(val) => setQ(val)}
        />
        <Input placeholder='Run ID' aria-label='Filter by run ID' allowClear style={{ width: 160 }} value={runId} onChange={(e) => setRunId(e.target.value)} />
        <AntSelect
          value={windowHours}
          style={{ width: 160 }}
          onChange={setWindowHours}
          options={WINDOW_OPTIONS}
        />
        <Tooltip title={canLiveTail(sortBy, sortDir) ? '' : 'Live tail needs the newest-first time sort'}>
          <span>
            <AntButton
              type={live ? 'primary' : 'default'}
              danger={live}
              disabled={!canLiveTail(sortBy, sortDir)}
              onClick={() => {
                const next = !live;
                setLive(next);
                saveLiveEnabled(next);
              }}
            >
              {live ? '● Live' : 'Live'}
            </AntButton>
          </span>
        </Tooltip>
        <LiveStatus live={live && canLiveTail(sortBy, sortDir)} hidden={liveHidden} failures={liveFailures} lastOkAt={liveLastOkAt} />
        {live && liveOverflow > 0 ? (
          <Box
            component='span'
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.25, borderRadius: '4px',
              fontSize: 11, fontWeight: 500,
              bgcolor: 'rgba(237,108,2,0.1)', color: 'warning.main',
              border: '1px solid rgba(237,108,2,0.3)',
            }}
          >
            +{liveOverflow} more events, narrow your query
          </Box>
        ) : null}
        {live && liveBehind > 0 ? (
          <Box
            component='span'
            title='A burst of events is arriving faster than one poll can carry; the table is catching up.'
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.25, borderRadius: '4px',
              fontSize: 11, fontWeight: 500,
              bgcolor: 'rgba(237,108,2,0.1)', color: 'warning.main',
              border: '1px solid rgba(237,108,2,0.3)',
            }}
          >
            {liveBehind.toLocaleString()} events behind — catching up
          </Box>
        ) : null}
        <LogsFilterSettingsDialog
          availableServices={facets.service.map((f) => f.value)}
          onSave={(saved) => {
            setFilterSettings(saved);
            setWindowHours(saved.defaultWindowHours);
            setFilters((prev) => ({
              ...prev,
              level: saved.defaultLevels ?? [],
              service: saved.defaultServices ?? [],
            }));
          }}
        />
      </Stack>

      {error ? <Alert severity='error'>{error}</Alert> : null}
      {windowCapped ? (
        <Alert severity='info'>Sorting by service or level is limited to the last 7 days — sort by time to see older events.</Alert>
      ) : null}

      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
          <Typography variant='caption' color='text.secondary'>
            Volume over the selected range
          </Typography>
          <Stack direction='row' spacing={1.5}>
            {Object.entries(LEVEL_COLOR).map(([level, color]) => (
              <Stack key={level} direction='row' spacing={0.75} alignItems='center'>
                <Box sx={{ width: 14, height: 4, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />
                <Typography variant='caption' color='text.primary'>
                  {level}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
        {grandTotal === 0 ? (
          <Typography variant='body2' color='text.secondary' sx={{ textAlign: 'center', py: 3 }}>
            No events in this range to chart.
          </Typography>
        ) : (
          <>
            <HistogramSVG
              bars={histogramBars}
              bucketMs={bucketMs}
              selectedIdx={selectedBucketIdx}
              onBarClick={(bi, bar) => {
                if (selectedBucketIdx === bi) {
                  // Toggle off — restore full-window events.
                  setSelectedBucketIdx(null);
                  setBucketFilter(null);
                  loadFirstPage();
                } else {
                  const since = bar.bucketStart;
                  const until = new Date(new Date(since).getTime() + bucketMs).toISOString();
                  setSelectedBucketIdx(bi);
                  setBucketFilter({ since, until, label: formatBucketRangeLabel(since, bucketMs) });
                  loadBucketEvents(since, until);
                }
              }}
            />
            <Stack direction='row' justifyContent='space-between' sx={{ mt: 0.5 }}>
              <Typography variant='caption' color='text.secondary'>
                {histogramBars[0] ? new Date(histogramBars[0].bucketStart).toLocaleString() : ''}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                now
              </Typography>
            </Stack>
          </>
        )}
      </Paper>

      {loading ? (
        <LoadingState title='Fetching logs' columns={[2, 1, 1, 1, 1, 3]} />
      ) : (
        <Paper
          variant='outlined'
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            '& .ant-table-wrapper': { borderRadius: 0 },
            '& .ant-table-container': { borderRadius: 0 },
            '& .ant-table-content': { borderRadius: 0 },
          }}
        >
          <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ p: 2 }}>
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary'>
                {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} loaded
                {filteredEvents.length !== events.length ? ` (${events.length - filteredEvents.length} hidden by filter)` : ''}
              </Typography>
              {bucketFilter && (
                <Box
                  component='span'
                  onClick={() => { setSelectedBucketIdx(null); setBucketFilter(null); loadFirstPage(); }}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.25, borderRadius: '4px', cursor: 'pointer',
                    fontSize: 11, fontWeight: 500,
                    bgcolor: 'rgba(27,69,143,0.08)', color: 'primary.main',
                    border: '1px solid rgba(27,69,143,0.2)',
                    '&:hover': { bgcolor: 'rgba(27,69,143,0.14)' },
                  }}
                >
                  {bucketFilter.label}&nbsp;×
                </Box>
              )}
            </Stack>
            {filteredEvents.length > 0 ? (
              <Button size='small' onClick={exportCsv}>
                Export CSV
              </Button>
            ) : null}
          </Stack>
          <LogsTable dataSource={filteredEvents} columns={columns} onChange={handleTableChange} />
          {nextCursor && hasReachedRowCap(events.length) ? (
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', textAlign: 'center', p: 1.5 }}>
              Showing the newest {LOG_ROW_CAP.toLocaleString()} events — narrow the time range or filters to see more.
            </Typography>
          ) : nextCursor ? (
            <Box sx={{ textAlign: 'center', p: 1.5 }}>
              <AntButton onClick={loadOlder} loading={loadingMore}>
                Load older events
              </AntButton>
            </Box>
          ) : null}
        </Paper>
      )}
    </Stack>
  );
};

export default LogsExplorer;
