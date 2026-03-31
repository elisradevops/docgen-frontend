import { describe, expect, test } from 'vitest';
import {
  buildHistoricalQueryTree,
  getWorkItemIconUrl,
  isSameOrigin,
  mapHistoricalQueriesFromSharedTree,
  normalizeHistoricalAsOfResult,
  normalizeHistoricalCompareResult,
  normalizeWorkItemColor,
} from './historicalQuery';

describe('historicalQuery utils', () => {
  test('buildHistoricalQueryTree returns empty array for empty input', () => {
    expect(buildHistoricalQueryTree([])).toEqual([]);
  });

  test('buildHistoricalQueryTree builds nested folders and deduplicates duplicate ids', () => {
    const tree = buildHistoricalQueryTree([
      { id: 'q1', queryName: 'Query 1', path: 'Shared Queries/Folder A' },
      { id: 'q1', queryName: 'Duplicate Query 1', path: 'Shared Queries/Folder A' },
      { id: 'q2', queryName: 'Query 2', path: 'Shared Queries/Folder A/Folder B' },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Shared Queries');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe('Folder A');
    expect(tree[0].children[0].children.some((node) => node.id === 'q1')).toBe(true);
  });

  test('normalizeWorkItemColor supports hex3/hex6/hex8 and passthrough for invalid', () => {
    expect(normalizeWorkItemColor('#abc')).toBe('#abc');
    expect(normalizeWorkItemColor('#aabbcc')).toBe('#aabbcc');
    expect(normalizeWorkItemColor('#aabbccdd')).toBe('#aabbcc');
    expect(normalizeWorkItemColor('aabbcc')).toBe('#aabbcc');
    expect(normalizeWorkItemColor('aabbccdd')).toBe('#aabbcc');
    expect(normalizeWorkItemColor('invalid')).toBe('invalid');
    expect(normalizeWorkItemColor(null)).toBeNull();
  });

  test('getWorkItemIconUrl supports string and known object keys', () => {
    expect(getWorkItemIconUrl('https://example/icon.svg')).toBe('https://example/icon.svg');
    expect(getWorkItemIconUrl({ dataUrl: 'data:image/png;base64,x' })).toBe('data:image/png;base64,x');
    expect(getWorkItemIconUrl({ url: '/icon.svg' })).toBe('/icon.svg');
    expect(getWorkItemIconUrl({ href: '/icon.svg' })).toBe('/icon.svg');
    expect(getWorkItemIconUrl(null)).toBeNull();
  });

  test('isSameOrigin validates data urls and absolute origins', () => {
    const base = 'https://example.com/app';
    expect(isSameOrigin('data:image/svg+xml;base64,AA==', base)).toBe(true);
    expect(isSameOrigin('/path/file', base)).toBe(true);
    expect(isSameOrigin('https://example.com/another', base)).toBe(true);
    expect(isSameOrigin('https://other.example.com/file', base)).toBe(false);
  });

  test('mapHistoricalQueriesFromSharedTree handles empty payload', () => {
    expect(mapHistoricalQueriesFromSharedTree(null)).toEqual([]);
    expect(mapHistoricalQueriesFromSharedTree({})).toEqual([]);
  });

  test('mapHistoricalQueriesFromSharedTree maps valid acquired tree payload', () => {
    const mapped = mapHistoricalQueriesFromSharedTree({
      acquiredTrees: {
        historicalQueryTree: {
          title: 'Shared Queries',
          children: [
            {
              title: 'Folder A',
              children: [
                { id: 'q1', title: 'Query 1', isValidQuery: true },
                { id: 'q2', title: 'Query 2', isValidQuery: true },
              ],
            },
          ],
        },
      },
    });

    expect(mapped).toEqual([
      { id: 'q1', queryName: 'Query 1', path: 'Shared Queries/Folder A' },
      { id: 'q2', queryName: 'Query 2', path: 'Shared Queries/Folder A' },
    ]);
  });

  test('mapHistoricalQueriesFromSharedTree handles flat list payload', () => {
    const mapped = mapHistoricalQueriesFromSharedTree([
      { id: 'q2', queryName: 'Query 2', path: 'Shared Queries/B' },
      { id: 'q1', queryName: 'Query 1', path: 'Shared Queries/A' },
    ]);

    expect(mapped).toEqual([
      { id: 'q1', queryName: 'Query 1', path: 'Shared Queries/A' },
      { id: 'q2', queryName: 'Query 2', path: 'Shared Queries/B' },
    ]);
  });

  test('mapHistoricalQueriesFromSharedTree ignores nodes with missing identifiers', () => {
    const mapped = mapHistoricalQueriesFromSharedTree({
      historicalQueryTree: {
        title: 'Shared Queries',
        children: [{ title: 'Broken Query', isValidQuery: true }],
      },
    });

    expect(mapped).toEqual([]);
  });

  test('normalizeHistoricalAsOfResult supports contract field names', () => {
    const normalized = normalizeHistoricalAsOfResult({
      queryName: 'My Query',
      asOfTimestamp: '2025-12-22T17:08:00.000Z',
      totalCount: 1,
      items: [{ id: 12, workItemType: 'Bug', title: 'Test' }],
    });

    expect(normalized.queryName).toBe('My Query');
    expect(normalized.asOf).toBe('2025-12-22T17:08:00.000Z');
    expect(normalized.total).toBe(1);
    expect(normalized.rows[0].id).toBe(12);
  });

  test('normalizeHistoricalCompareResult supports contract field names', () => {
    const normalized = normalizeHistoricalCompareResult({
      queryName: 'My Query',
      baselineTimestamp: '2025-12-22T17:08:00.000Z',
      compareToTimestamp: '2025-12-28T08:57:00.000Z',
      baselineCount: 4,
      compareToCount: 5,
      updatedCount: 2,
      rows: [{ id: 1, compareStatus: 'changed', title: 'WI 1' }],
    });

    expect(normalized.queryName).toBe('My Query');
    expect(normalized.baseline.asOf).toBe('2025-12-22T17:08:00.000Z');
    expect(normalized.compareTo.asOf).toBe('2025-12-28T08:57:00.000Z');
    expect(normalized.summary.updatedCount).toBe(2);
    expect(normalized.rows[0].compareStatus).toBe('Changed');
  });
});
