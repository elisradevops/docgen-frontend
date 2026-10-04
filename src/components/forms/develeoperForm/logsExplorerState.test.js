import { describe, expect, test } from 'vitest';
import {
  buildEventQueryParams,
  mergeLiveRows,
  computeLiveOverflow,
  formatRequestLine,
  formatRequestDetail,
  buildDetailsText,
  buildLogsCsv,
  appendOlderEvents,
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
  test('prepends genuinely new rows ahead of the existing list', () => {
    const existing = [{ _id: '2' }, { _id: '1' }];
    const polled = [{ _id: '3' }, { _id: '2' }];
    expect(mergeLiveRows(existing, polled)).toEqual([{ _id: '3' }, { _id: '2' }, { _id: '1' }]);
  });

  test('is a no-op when the poll returns only already-seen rows', () => {
    const existing = [{ _id: '1' }];
    expect(mergeLiveRows(existing, [{ _id: '1' }])).toEqual(existing);
  });

  test('caps how many new rows are admitted in a single poll (burst protection)', () => {
    const polled = Array.from({ length: 10 }, (_, i) => ({ _id: `new-${i}` }));
    const result = mergeLiveRows([], polled, { capPerPoll: 3, maxTotal: 1000 });
    expect(result).toHaveLength(3);
  });

  test('caps the combined total so a long-running tail stays bounded', () => {
    const existing = Array.from({ length: 998 }, (_, i) => ({ _id: `old-${i}` }));
    const polled = [{ _id: 'new-1' }, { _id: 'new-2' }, { _id: 'new-3' }];
    const result = mergeLiveRows(existing, polled, { capPerPoll: 200, maxTotal: 1000 });
    expect(result).toHaveLength(1000);
    expect(result[0]._id).toBe('new-1'); // newest rows survive the cap, oldest fall off the end
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
    expect(header).toBe('Time,Level,Service,Project,Type,Run,Message,Request,Stack');
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
