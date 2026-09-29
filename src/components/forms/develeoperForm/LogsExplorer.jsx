import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { Table, Button as AntButton, Select as AntSelect, Input, Checkbox, Space } from 'antd';
import LoadingState from '../../common/LoadingState';
import {
  getDiagnosticsEvents,
  getDiagnosticsEventFacets,
  getDiagnosticsEventHistogram,
} from '../../../store/data/docManagerApi';
import {
  buildEventQueryParams,
  mergeLiveRows,
  appendOlderEvents,
  buildHistogramBars,
  formatBucketRangeLabel,
  filterFacetValues,
} from './logsExplorerState';

// Real semantic colors, not invented — same tokens the rest of the app already renders for
// Chip color='error'/'warning' (error.main / MUI's uncustomized warning.main default).
const LEVEL_COLOR = { error: '#D1434B', warn: '#ED6C02', info: '#94a3b8', debug: '#64748b' };
const WINDOW_OPTIONS = [
  { label: 'Last hour', value: 1 },
  { label: 'Last 24 hours', value: 24 },
  { label: 'Last 7 days', value: 168 },
  { label: 'Last 30 days', value: 720 },
];
const LIVE_POLL_MS = 5000;
const MESSAGE_TRUNCATE_LENGTH = 140;

const FACET_DIMENSIONS = ['level', 'service', 'project', 'docType'];

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

const LogsExplorer = ({ onOpenRun }) => {
  const [windowHours, setWindowHours] = useState(24);
  const [filters, setFilters] = useState({ level: [], service: [], project: [], docType: [] });
  const [q, setQ] = useState('');
  const [runId, setRunId] = useState('');
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
  const [live, setLive] = useState(false);
  const liveTimerRef = useRef(null);

  const queryState = useMemo(
    () => ({ ...filters, q, runId: runId.trim() || undefined, windowHours, sortBy, sortDir }),
    [filters, q, runId, windowHours, sortBy, sortDir]
  );

  const loadFirstPage = useCallback(async () => {
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
      setEvents(eventsRes.events || []);
      setNextCursor(eventsRes.nextCursor);
      setFacets(facetsRes.facets || { level: [], service: [], project: [], docType: [] });
      setHistogram(histogramRes.buckets || []);
    } catch (err) {
      setError(err.message || 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // Live tail: polls for the newest page (no cursor) and prepends genuinely-new rows, capped
  // per poll so a synthetic burst can't flood the table in one tick — see mergeLiveRows.
  useEffect(() => {
    if (!live) return undefined;
    liveTimerRef.current = window.setInterval(async () => {
      try {
        const params = buildEventQueryParams(queryState);
        if (queryState.runId) params.runId = queryState.runId;
        const res = await getDiagnosticsEvents(params);
        setEvents((prev) => mergeLiveRows(prev, res.events || []));
      } catch {
        // A single missed poll isn't worth surfacing as an error banner — the next tick retries.
      }
    }, LIVE_POLL_MS);
    return () => {
      if (liveTimerRef.current) window.clearInterval(liveTimerRef.current);
    };
  }, [live, queryState]);

  const loadOlder = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = buildEventQueryParams(queryState);
      if (queryState.runId) params.runId = queryState.runId;
      params.cursor = nextCursor;
      const res = await getDiagnosticsEvents(params);
      setEvents((prev) => appendOlderEvents(prev, res.events || []));
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err.message || 'Failed to load older events.');
    } finally {
      setLoadingMore(false);
    }
  };

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

  const columns = [
    {
      title: 'Time',
      dataIndex: 'ts',
      key: 'ts',
      width: 170,
      sorter: true,
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
      width: 130,
      render: (id) =>
        id ? (
          <span>
            <AntButton type='link' size='small' style={{ padding: 0 }} onClick={() => setRunId(id)} title='Filter this table to this run'>
              {String(id).slice(0, 8)}
            </AntButton>
            {typeof onOpenRun === 'function' ? (
              <AntButton type='link' size='small' style={{ padding: '0 0 0 4px' }} onClick={() => onOpenRun(id)} title='Open run detail'>
                ↗
              </AntButton>
            ) : null}
          </span>
        ) : null,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (message, record) => {
        const isExpanded = expandedRowId === record._id;
        const isLong = (message || '').length > MESSAGE_TRUNCATE_LENGTH;
        const hasStack = !!record.err?.stack;
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
            {hasStack ? (
              <div>
                <AntButton
                  type='link'
                  size='small'
                  style={{ padding: 0, fontSize: 11 }}
                  onClick={() => setExpandedStackId(isStackExpanded ? null : record._id)}
                >
                  {isStackExpanded ? 'Stack ▴' : 'Stack ▾'}
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
                    {record.err.stack}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  const handleTableChange = (_pagination, _tableFilters, sorter) => {
    if (sorter?.order) {
      setSortBy(sorter.columnKey);
      setSortDir(sorter.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortBy('ts');
      setSortDir('desc');
    }
  };

  const histogramBars = useMemo(() => buildHistogramBars(histogram), [histogram]);
  const bucketMs = histogram.length >= 2 ? new Date(histogram[1].bucketStart) - new Date(histogram[0].bucketStart) : 0;
  const grandTotal = histogramBars.reduce((sum, b) => sum + b.total, 0);

  const exportCsv = () => {
    const escape = (val) => {
      const s = val == null ? '' : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = 'Time,Level,Service,Project,Type,Run,Message,Stack';
    const rows = events.map((e) =>
      [
        e.ts ? new Date(e.ts).toISOString() : '',
        e.level || '',
        e.service || '',
        e.project || '',
        e.docType || '',
        e.runId || '',
        e.message || '',
        e.err?.stack || '',
      ]
        .map(escape)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2}>
      <Stack direction='row' spacing={1.5} flexWrap='wrap' alignItems='center'>
        <Input.Search
          placeholder='Search message text…'
          allowClear
          style={{ width: 260 }}
          defaultValue={q}
          onSearch={(val) => setQ(val)}
        />
        <Input placeholder='Run ID' allowClear style={{ width: 160 }} value={runId} onChange={(e) => setRunId(e.target.value)} />
        <AntSelect
          value={windowHours}
          style={{ width: 160 }}
          onChange={setWindowHours}
          options={WINDOW_OPTIONS}
        />
        <AntButton type={live ? 'primary' : 'default'} danger={live} onClick={() => setLive((v) => !v)}>
          {live ? '● Live' : 'Live'}
        </AntButton>
      </Stack>

      {error ? <Alert severity='error'>{error}</Alert> : null}

      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
          <Typography variant='caption' color='text.secondary'>
            Volume over the selected range
          </Typography>
          <Stack direction='row' spacing={1.5}>
            {Object.entries(LEVEL_COLOR).map(([level, color]) => (
              <Stack key={level} direction='row' spacing={0.5} alignItems='center'>
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color }} />
                <Typography variant='caption' color='text.secondary'>
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
            <Box sx={{ display: 'flex', alignItems: 'stretch', gap: '2px', height: 88, borderBottom: '1px solid', borderColor: 'divider' }}>
              {histogramBars.map((bar) => (
                <Tooltip
                  key={bar.bucketStart}
                  title={
                    <>
                      <div>{formatBucketRangeLabel(bar.bucketStart, bucketMs)}</div>
                      {bar.segments.filter((s) => s.count > 0).map((s) => (
                        <div key={s.level}>
                          {s.count} {s.level}
                        </div>
                      ))}
                    </>
                  }
                >
                  <Box
                    sx={{ flex: 1, minWidth: 2, height: '100%', display: 'flex', flexDirection: 'column-reverse', cursor: 'pointer' }}
                    onClick={() => {
                      const start = new Date(bar.bucketStart);
                      setWindowHours(Math.max(1, Math.ceil((Date.now() - start.getTime()) / (60 * 60 * 1000))));
                    }}
                  >
                    {bar.segments.map((s) => (
                      <Box key={s.level} sx={{ height: `${s.heightPct}%`, bgcolor: LEVEL_COLOR[s.level] }} />
                    ))}
                  </Box>
                </Tooltip>
              ))}
            </Box>
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
          <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ px: 1, pt: 1 }}>
            <Typography variant='caption' color='text.secondary'>
              {events.length} event{events.length === 1 ? '' : 's'} loaded
            </Typography>
            {events.length > 0 ? (
              <Button size='small' onClick={exportCsv}>
                Export CSV
              </Button>
            ) : null}
          </Stack>
          <Table
            dataSource={events}
            columns={columns}
            rowKey={(record) => record._id}
            pagination={false}
            onChange={handleTableChange}
            size='small'
          />
          {nextCursor ? (
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
