import { describe, expect, test } from 'vitest';
import {
  buildEventQueryParams,
  mergeLiveRows,
  liveAnnouncement,
  isFullTailPage,
  tailCursorAfter,
  liveBehind,
  LIVE_MAX_DRAIN,
  computeLiveOverflow,
  aggregateRefreshDelay,
  AGGREGATE_REFRESH_MS,
  formatRequestLine,
  formatRequestDetail,
  buildDetailsText,
  buildLogsCsv,
  appendOlderEvents,
  hasReachedRowCap,
  canLiveTail,
  isRequestId,
  idInsertedAtMs,
  advanceLiveBoundary,
  liveStatus,
  runCellActions,
  formatStepLine,
  isSessionId,
  isCorrelationOnlyId,
  formatRunCellLabel,
  TIME_SORT_DIRECTIONS,
  sortStateFromSorter,
  LOG_ROW_CAP,
  buildHistogramBars,
  formatBucketRangeLabel,
  filterFacetValues,
} from './logsExplorerState';

describe('buildEventQueryParams', () => {
  test('omits empty filters entirely', () => {
    expect(buildEventQueryParams({ level: [], service: [], project: [], docType: [], q: '', windowHours: 0 })).toEqual({});
  });

  test('includes populated array filters', () => {
    const params = buildEventQueryParams({ level: ['error', 'warn'], service: [], project: [], docType: [] });
    expect(params).toEqual({ level: ['error', 'warn'] });
  });

  test('trims free-text search', () => {
    expect(buildEventQueryParams({ q: '  timeout  ' })).toEqual({ q: 'timeout' });
  });

  test('converts windowHours into a since timestamp', () => {
    const params = buildEventQueryParams({ windowHours: 24 });
    expect(new Date(params.since).getTime()).toBeLessThan(Date.now());
    expect(new Date(params.since).getTime()).toBeGreaterThan(Date.now() - 25 * 60 * 60 * 1000);
  });

  test('includes sort fields only when supplied', () => {
    expect(buildEventQueryParams({ sortBy: 'service', sortDir: 'asc' })).toEqual({ sortBy: 'service', sortDir: 'asc' });
  });
});

describe('mergeLiveRows', () => {
  const ev = (id, ts) => ({ _id: id, ts });

  test('puts genuinely new rows in time order, newest first', () => {
    const existing = [ev('2', '2026-10-05T10:00:02Z'), ev('1', '2026-10-05T10:00:01Z')];
    const polled = [ev('3', '2026-10-05T10:00:03Z'), ev('2', '2026-10-05T10:00:02Z')];
    expect(mergeLiveRows(existing, polled).map((e) => e._id)).toEqual(['3', '2', '1']);
  });

  test('a late event (older ts, stored after a newer one) slots into its place instead of landing on top', () => {
    const existing = [ev('b', '2026-10-05T10:00:03Z'), ev('a', '2026-10-05T10:00:00Z')];
    const late = [ev('c', '2026-10-05T10:00:01Z')]; // the slow service's event, arriving last
    expect(mergeLiveRows(existing, late).map((e) => e._id)).toEqual(['b', 'c', 'a']);
  });

  test('equal timestamps order by id, newest id first, and the result is stable across merges', () => {
    const t = '2026-10-05T10:00:00Z';
    const merged = mergeLiveRows([ev('a1', t)], [ev('a3', t), ev('a2', t)]);
    expect(merged.map((e) => e._id)).toEqual(['a3', 'a2', 'a1']);
    expect(mergeLiveRows(merged, [ev('a2', t)])).toBe(merged);
  });

  test('is a no-op (same array) when the poll returns only already-seen rows', () => {
    const existing = [ev('1', '2026-10-05T10:00:00Z')];
    expect(mergeLiveRows(existing, [ev('1', '2026-10-05T10:00:00Z')])).toBe(existing);
  });

  test('caps how many new rows are admitted in a single poll (burst protection)', () => {
    const polled = Array.from({ length: 10 }, (_, i) => ev(`new-${i}`, '2026-10-05T10:00:00Z'));
    expect(mergeLiveRows([], polled, { capPerPoll: 3, maxTotal: 1000 })).toHaveLength(3);
  });

  test('caps the combined total: the newest rows survive, the oldest fall off the end', () => {
    const existing = Array.from({ length: 998 }, (_, i) => ev(`old-${i}`, new Date(Date.UTC(2026, 9, 5, 9, 0, 0) + i * 1000).toISOString()));
    const polled = [ev('new-1', '2026-10-05T11:00:03Z'), ev('new-2', '2026-10-05T11:00:02Z'), ev('new-3', '2026-10-05T11:00:01Z')];
    const result = mergeLiveRows(existing, polled, { capPerPoll: 200, maxTotal: 1000 });
    expect(result).toHaveLength(1000);
    expect(result[0]._id).toBe('new-1');
  });
});

describe('idInsertedAtMs / advanceLiveBoundary (live tail by arrival)', () => {
  // ObjectId creation time: first 4 bytes, seconds since the epoch.
  const oid = (iso) => Math.floor(Date.parse(iso) / 1000).toString(16).padStart(8, '0') + 'a1b2c3d4e5f60718';

  test('reads the insertion time from an ObjectId, and NaN from anything else', () => {
    expect(idInsertedAtMs(oid('2026-10-05T10:00:12Z'))).toBe(Date.parse('2026-10-05T10:00:12Z'));
    ['', 'abc', undefined, null, 42, 'zzzzzzzzzzzzzzzzzzzzzzzz', oid('2026-10-05T10:00:12Z') + '0'].forEach((bad) =>
      expect(Number.isNaN(idInsertedAtMs(bad))).toBe(true)
    );
  });

  test('advances to the newest insertion time seen', () => {
    const events = [{ _id: oid('2026-10-05T10:00:05Z') }, { _id: oid('2026-10-05T10:00:09Z') }];
    expect(advanceLiveBoundary(Date.parse('2026-10-05T10:00:01Z'), events, undefined)).toBe(Date.parse('2026-10-05T10:00:09Z'));
  });

  test('never goes backwards: a poll of older rows leaves the boundary where it was', () => {
    const events = [{ _id: oid('2026-10-05T10:00:02Z') }];
    expect(advanceLiveBoundary(Date.parse('2026-10-05T10:00:09Z'), events, undefined)).toBe(Date.parse('2026-10-05T10:00:09Z'));
  });

  test('with nothing yet, starts from the SERVER clock — never the browser\'s', () => {
    expect(advanceLiveBoundary(null, [], Date.parse('2026-10-05T10:00:00Z'))).toBe(Date.parse('2026-10-05T10:00:00Z'));
    expect(advanceLiveBoundary(undefined, [{ _id: 'not-an-id' }], 5)).toBe(5);
  });

  test('null when there is nothing to anchor to', () => {
    expect(advanceLiveBoundary(null, [], undefined)).toBeNull();
  });

  test('the bug this exists for: a late event with an old ts is still after the boundary by id', () => {
    // seen: an api-gate event stamped 10:00:03, stored 10:00:03. Then the content-control event stamped
    // 10:00:01 is stored at 10:00:04 — older ts, newer id. A ts boundary (10:00:03) would skip it; the
    // insertion boundary does not.
    const boundary = advanceLiveBoundary(null, [{ _id: oid('2026-10-05T10:00:03Z'), ts: '2026-10-05T10:00:03Z' }], undefined);
    const late = { _id: oid('2026-10-05T10:00:04Z'), ts: '2026-10-05T10:00:01Z' };
    expect(idInsertedAtMs(late._id)).toBeGreaterThanOrEqual(boundary);
    expect(Date.parse(late.ts)).toBeLessThan(boundary); // what a ts boundary would have wrongly excluded
  });
});

describe('liveStatus', () => {
  const base = { live: true, hidden: false, failures: 0, lastOkAt: 10_000, now: 12_000 };
  test('off', () => expect(liveStatus({ ...base, live: false })).toEqual({ tone: 'idle', label: 'Live off' }));
  test('paused while the tab is hidden', () => expect(liveStatus({ ...base, hidden: true }).label).toContain('Paused'));
  test('one failed poll is not called out; two are', () => {
    expect(liveStatus({ ...base, failures: 1 }).tone).toBe('live');
    expect(liveStatus({ ...base, failures: 2 })).toMatchObject({ tone: 'warn', label: expect.stringContaining('Reconnecting') });
  });
  test('connecting before the first poll, then how long ago it updated', () => {
    expect(liveStatus({ ...base, lastOkAt: undefined }).label).toBe('Live · connecting…');
    expect(liveStatus(base).label).toBe('Live · updated 2s ago');
    expect(liveStatus({ ...base, now: 10_400 }).label).toBe('Live · just now');
  });
});

describe('computeLiveOverflow', () => {
  test('is 0 when matchedCount equals what was received (nothing dropped)', () => {
    expect(computeLiveOverflow(12, 12)).toBe(0);
  });

  test('is the positive difference when matchedCount exceeds what was received', () => {
    expect(computeLiveOverflow(342, 50)).toBe(292);
  });

  test('is 0 when matchedCount was not requested/returned (undefined)', () => {
    expect(computeLiveOverflow(undefined, 50)).toBe(0);
  });

  test('clamps to 0 rather than going negative if receivedCount somehow exceeds matchedCount', () => {
    expect(computeLiveOverflow(5, 10)).toBe(0);
  });
});

describe('appendOlderEvents', () => {
  test('appends without reordering existing rows', () => {
    const existing = [{ _id: '1' }, { _id: '2' }];
    const older = [{ _id: '3' }, { _id: '4' }];
    expect(appendOlderEvents(existing, older)).toEqual([{ _id: '1' }, { _id: '2' }, { _id: '3' }, { _id: '4' }]);
  });

  test('dedupes against already-loaded rows', () => {
    const existing = [{ _id: '1' }, { _id: '2' }];
    expect(appendOlderEvents(existing, [{ _id: '2' }, { _id: '3' }])).toEqual([{ _id: '1' }, { _id: '2' }, { _id: '3' }]);
  });
});

describe('buildHistogramBars', () => {
  test('computes heightPct relative to the tallest bucket total, per level', () => {
    const buckets = [
      { bucketStart: '2026-01-01T00:00:00.000Z', counts: { error: 10, warn: 0 } },
      { bucketStart: '2026-01-01T01:00:00.000Z', counts: { error: 5 } },
    ];
    const bars = buildHistogramBars(buckets);
    expect(bars[0].total).toBe(10);
    expect(bars[0].segments.find((s) => s.level === 'error').heightPct).toBe(100);
    expect(bars[1].segments.find((s) => s.level === 'error').heightPct).toBe(50);
  });

  test('produces zero heights for an all-empty range without dividing by zero', () => {
    const bars = buildHistogramBars([{ bucketStart: '2026-01-01T00:00:00.000Z', counts: {} }]);
    expect(bars[0].total).toBe(0);
    expect(bars[0].segments.every((s) => s.heightPct === 0)).toBe(true);
  });
});

describe('formatBucketRangeLabel', () => {
  test('formats a start–end range from a bucket width in ms', () => {
    const label = formatBucketRangeLabel('2026-01-01T12:00:00.000Z', 60 * 60 * 1000);
    expect(label).toContain('–');
  });
});

describe('filterFacetValues', () => {
  const values = [
    { value: 'dg-api-gate', count: 5 },
    { value: 'dg-content-control', count: 3 },
  ];

  test('returns everything when search is empty', () => {
    expect(filterFacetValues(values, '')).toEqual(values);
  });

  test('filters case-insensitively by substring', () => {
    expect(filterFacetValues(values, 'CONTENT')).toEqual([{ value: 'dg-content-control', count: 3 }]);
  });

  test('returns an empty array when nothing matches', () => {
    expect(filterFacetValues(values, 'zzz')).toEqual([]);
  });
});

describe('formatRequestLine / formatRequestDetail', () => {
  test('empty for a missing context', () => {
    expect(formatRequestLine(undefined)).toBe('');
    expect(formatRequestDetail({})).toBe('');
  });

  test('request line shows method, url and status', () => {
    expect(formatRequestLine({ method: 'GET', url: 'https://h/x', status: 404 })).toBe('GET https://h/x -> 404');
    expect(formatRequestLine({ url: 'https://h/x' })).toBe('https://h/x');
  });

  test('detail adds attempt, body and response when present', () => {
    const out = formatRequestDetail({
      method: 'POST',
      url: 'https://h/wiql',
      status: 400,
      attempt: 3,
      requestBody: '{"query":"q"}',
      responseExcerpt: 'bad query',
    });
    expect(out.split('\n')).toEqual([
      'POST https://h/wiql -> 400',
      'Attempt: 3',
      'Body: {"query":"q"}',
      'Response: bad query',
    ]);
  });
});

describe('buildDetailsText', () => {
  const context = { method: 'GET', url: 'https://h/x', status: 404 };
  test('request detail and stack joined by a blank line', () => {
    expect(buildDetailsText({ context, err: { stack: 'STACK' } })).toBe('GET https://h/x -> 404\n\nSTACK');
  });
  test('context-only, stack-only and neither', () => {
    expect(buildDetailsText({ context })).toBe('GET https://h/x -> 404');
    expect(buildDetailsText({ err: { stack: 'STACK' } })).toBe('STACK');
    expect(buildDetailsText({})).toBe('');
  });
});

describe('buildLogsCsv', () => {
  test('header has a Request column and rows carry the request detail', () => {
    const csv = buildLogsCsv([
      { ts: '2026-10-04T10:00:00.000Z', level: 'error', message: 'boom', context: { method: 'GET', url: 'https://h/x', status: 404 } },
    ]);
    const [header, row] = csv.split('\n');
    expect(header).toBe('Time,Level,Service,Project,Type,Run,Step,Message,Request,Stack');
    expect(row).toContain('GET https://h/x -> 404');
  });
  test('quotes cells containing commas, quotes and newlines', () => {
    const row = buildLogsCsv([{ level: 'error', message: 'a,"b"\nc' }]).split('\n')[1];
    expect(row).toContain('"a,""b""');
  });
  test('neutralises formula-leading cells', () => {
    const row = buildLogsCsv([{ level: 'error', message: '=HYPERLINK("http://x")' }]).split('\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(buildLogsCsv([{ message: '@SUM(1)' }])).toContain("'@SUM(1)");
  });
});

describe('row cap and live-tail gating', () => {
  const rows = (n, start = 0) => Array.from({ length: n }, (_, i) => ({ _id: `e${start + i}`, ts: '2026-10-04T10:00:00Z' }));
  test('appendOlderEvents never grows past maxTotal', () => {
    expect(appendOlderEvents(rows(1990), rows(50, 1990)).length).toBe(LOG_ROW_CAP);
    expect(appendOlderEvents(rows(3), rows(5, 3), { maxTotal: 4 }).map((e) => e._id)).toEqual(['e0', 'e1', 'e2', 'e3']);
  });
  test('hasReachedRowCap flips at the cap', () => {
    expect(hasReachedRowCap(LOG_ROW_CAP - 1)).toBe(false);
    expect(hasReachedRowCap(LOG_ROW_CAP)).toBe(true);
  });
  test('live tail only for newest-first time sort', () => {
    expect(canLiveTail('ts', 'desc')).toBe(true);
    expect(canLiveTail('ts', 'asc')).toBe(false);
    expect(canLiveTail('service', 'desc')).toBe(false);
  });
});

describe('request ids vs run ids', () => {
  test('only req- prefixed ids are requests', () => {
    expect(isRequestId('req-3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true);
    expect(isRequestId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(false);
    expect(isRequestId('request-1')).toBe(false);
    expect(isRequestId(undefined)).toBe(false);
  });
  test('cell label distinguishes them', () => {
    expect(formatRunCellLabel('req-3f2504e0-4f89')).toBe('req · 3f2504');
    expect(formatRunCellLabel('3f2504e0-4f89-11d3')).toBe('3f2504e0');
  });
});

describe('session ids', () => {
  test('ses- ids are sessions, and request and session ids are both correlation-only', () => {
    expect(isSessionId('ses-9d2f')).toBe(true);
    expect(isSessionId('req-9d2f')).toBe(false);
    expect(isCorrelationOnlyId('ses-9d2f')).toBe(true);
    expect(isCorrelationOnlyId('req-9d2f')).toBe(true);
    expect(isCorrelationOnlyId('3f2504e0-4f89')).toBe(false);
    expect(isCorrelationOnlyId(undefined)).toBe(false);
  });
  test('session label', () => {
    expect(formatRunCellLabel('ses-3f2504e0-4f89')).toBe('session · 3f2504');
  });
});

describe('Time column sort', () => {
  // antd's own rule (es/table/hooks/useSorter.js): next = directions[indexOf(current) + 1]; no
  // current → directions[0]; past the end → undefined, i.e. cancel.
  const next = (directions, current) => (current ? directions[directions.indexOf(current) + 1] : directions[0]);

  test('the default antd cycle gets stuck on newest-first (the bug)', () => {
    expect(next(['ascend', 'descend'], 'descend')).toBeUndefined();
  });

  test('with TIME_SORT_DIRECTIONS the controlled "descend" state can reach ascending, then cancel', () => {
    expect(next(TIME_SORT_DIRECTIONS, 'descend')).toBe('ascend');
    expect(next(TIME_SORT_DIRECTIONS, 'ascend')).toBeUndefined();
  });

  test('sortStateFromSorter maps antd sorters to the query sort; a cancel falls back to newest first', () => {
    expect(sortStateFromSorter({ columnKey: 'ts', order: 'ascend' })).toEqual({ sortBy: 'ts', sortDir: 'asc' });
    expect(sortStateFromSorter({ columnKey: 'ts', order: 'descend' })).toEqual({ sortBy: 'ts', sortDir: 'desc' });
    expect(sortStateFromSorter({ columnKey: 'level', order: 'ascend' })).toEqual({ sortBy: 'level', sortDir: 'asc' });
    expect(sortStateFromSorter({ columnKey: 'level', order: undefined })).toEqual({ sortBy: 'ts', sortDir: 'desc' });
    expect(sortStateFromSorter(undefined)).toEqual({ sortBy: 'ts', sortDir: 'desc' });
  });

  test('a full click sequence on Time goes newest → oldest → newest', () => {
    let order = 'descend'; // initial controlled state
    const clicks = [];
    for (let i = 0; i < 3; i += 1) {
      order = next(TIME_SORT_DIRECTIONS, order);
      const state = sortStateFromSorter({ columnKey: 'ts', order });
      clicks.push(state.sortDir);
      order = state.sortDir === 'asc' ? 'ascend' : 'descend'; // the controlled sortOrder after the update
    }
    expect(clicks).toEqual(['asc', 'desc', 'asc']);
  });
});

describe('formatStepLine', () => {
  test('step and content control title, either may be missing', () => {
    expect(formatStepLine({ step: 'generate-content-control', contentControlTitle: 'Test Plan' })).toBe(
      'generate-content-control › Test Plan'
    );
    expect(formatStepLine({ step: 'render-document' })).toBe('render-document');
    expect(formatStepLine({ contentControlTitle: 'Test Plan' })).toBe('Test Plan');
  });
  test('empty when the record has neither (interactive request, system line)', () => {
    expect(formatStepLine({})).toBe('');
    expect(formatStepLine({ step: '  ', contentControlTitle: 5 })).toBe('');
    expect(formatStepLine(null)).toBe('');
  });
  test('the CSV carries it in a Step column', () => {
    const csv = buildLogsCsv([{ ts: '2026-10-05T08:00:00Z', level: 'warn', message: 'm', step: 'generate-content-control', contentControlTitle: 'Release range' }]);
    const [, row] = csv.split('\n');
    expect(row).toContain(',generate-content-control › Release range,m');
  });
});

describe('runCellActions', () => {
  test('a real run opens on click and offers a filter icon', () => {
    expect(runCellActions('3f2504e0-4f89-11d3', true)).toEqual({ primary: 'open', showFilterIcon: true });
  });
  test('without an open handler a run id filters', () => {
    expect(runCellActions('3f2504e0-4f89-11d3', false)).toEqual({ primary: 'filter', showFilterIcon: false });
  });
  test('request and session ids have no run page: they filter, with no extra icon', () => {
    expect(runCellActions('req-3f2504e0', true)).toEqual({ primary: 'filter', showFilterIcon: false });
    expect(runCellActions('ses-3f2504e0', true)).toEqual({ primary: 'filter', showFilterIcon: false });
  });
  test('no id, no actions', () => {
    expect(runCellActions('', true)).toEqual({ primary: 'none', showFilterIcon: false });
    expect(runCellActions(undefined, true)).toEqual({ primary: 'none', showFilterIcon: false });
  });
});


describe('aggregateRefreshDelay', () => {
  const base = { newRows: 3, lastRefreshAt: 0, now: 1_000_000, pending: false, paused: false };

  test('refreshes at once when the last refresh is older than the interval', () => {
    expect(aggregateRefreshDelay(base)).toBe(0);
  });

  test('waits out the rest of the interval after a recent refresh', () => {
    expect(aggregateRefreshDelay({ ...base, lastRefreshAt: base.now - 4000 })).toBe(AGGREGATE_REFRESH_MS - 4000);
  });

  test('treats a missing last refresh as old', () => {
    expect(aggregateRefreshDelay({ ...base, lastRefreshAt: undefined })).toBe(0);
  });

  test('schedules nothing when the poll brought no rows', () => {
    expect(aggregateRefreshDelay({ ...base, newRows: 0 })).toBeNull();
    expect(aggregateRefreshDelay({ ...base, newRows: undefined })).toBeNull();
  });

  test('schedules nothing while a refresh is already waiting', () => {
    expect(aggregateRefreshDelay({ ...base, pending: true })).toBeNull();
  });

  test('schedules nothing while a histogram bar is selected', () => {
    expect(aggregateRefreshDelay({ ...base, paused: true })).toBeNull();
  });

  test('never returns a negative delay', () => {
    expect(aggregateRefreshDelay({ ...base, lastRefreshAt: base.now - 60_000 })).toBe(0);
  });
});

describe('mergeLiveRows keeps rows loaded with Load older', () => {
  const row = (n) => ({ _id: String(n).padStart(6, '0'), ts: new Date(Date.UTC(2026, 9, 5, 10, 0, 0) - n * 1000).toISOString() });

  test('does not trim a table that is longer than 1000 rows (up to the row cap)', () => {
    const existing = Array.from({ length: 1500 }, (_, i) => row(i + 10));
    const merged = mergeLiveRows(existing, [row(1)]);
    expect(merged).toHaveLength(1501);
    expect(merged[1500]).toBe(existing[1499]);
  });

  test('never grows past the row cap', () => {
    const existing = Array.from({ length: LOG_ROW_CAP }, (_, i) => row(i + 10));
    expect(mergeLiveRows(existing, [row(1)])).toHaveLength(LOG_ROW_CAP);
  });
});

describe('liveAnnouncement', () => {
  test('is stable while the status only counts seconds', () => {
    expect(liveAnnouncement({ tone: 'live', label: 'Live · updated 7s ago' })).toBe(liveAnnouncement({ tone: 'live', label: 'Live · just now' }));
  });
  test('says when it is reconnecting and passes an idle label through', () => {
    expect(liveAnnouncement({ tone: 'warn', label: 'Reconnecting… (3 failed polls)' })).toBe('Live updates are reconnecting');
    expect(liveAnnouncement({ tone: 'idle', label: 'Live off' })).toBe('Live off');
  });
});

describe('cursor tail helpers', () => {
  const page = (n, extra = {}) => ({ tail: true, events: Array.from({ length: n }, (_, i) => ({ _id: `id${i + 1}` })), ...extra });

  test('a full tail page asks for an immediate next poll; a short one does not', () => {
    expect(isFullTailPage(page(200))).toBe(true);
    expect(isFullTailPage(page(199))).toBe(false);
    expect(isFullTailPage(page(3), 3)).toBe(true);
  });

  test('an api-gate without tail mode never looks "full" (it ignored the parameters)', () => {
    expect(isFullTailPage({ events: new Array(200).fill({ _id: 'x' }) })).toBe(false);
    expect(tailCursorAfter({ events: [{ _id: 'a' }] })).toBeNull();
    expect(liveBehind({ behind: 50 })).toBe(0);
  });

  test('the cursor is the last (newest) event of the oldest-first page', () => {
    expect(tailCursorAfter(page(3))).toBe('id3');
    expect(tailCursorAfter(page(0))).toBeNull();
    expect(tailCursorAfter(undefined)).toBeNull();
  });

  test('behind is a non-negative whole number, 0 when absent or not a number', () => {
    expect(liveBehind(page(1, { behind: 72 }))).toBe(72);
    expect(liveBehind(page(1, { behind: -5 }))).toBe(0);
    expect(liveBehind(page(1, { behind: 3.9 }))).toBe(3);
    expect(liveBehind(page(1, { behind: 'x' }))).toBe(0);
    expect(liveBehind(page(1))).toBe(0);
  });

  test('draining is bounded', () => {
    expect(LIVE_MAX_DRAIN).toBeGreaterThan(0);
    expect(LIVE_MAX_DRAIN).toBeLessThanOrEqual(20);
  });
});
