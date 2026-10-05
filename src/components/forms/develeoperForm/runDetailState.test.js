import { describe, expect, test } from 'vitest';
import { formatRunDuration, formatRunStatusLabel, buildTimelineRows, sortDiffRows, bandLabel, formatDiffValue, mergeRunLog, formatCaptureLabel, pickRunInput } from './runDetailState';

describe('formatRunDuration', () => {
  test('formats a completed run as seconds with one decimal', () => {
    const run = { startedAt: '2026-09-23T12:04:01.000Z', endedAt: '2026-09-23T12:04:11.400Z' };
    expect(formatRunDuration(run)).toBe('10.4s');
  });

  test('reports "in progress" for a run with no endedAt', () => {
    expect(formatRunDuration({ startedAt: '2026-09-23T12:04:01.000Z' })).toBe('in progress');
  });

  test('returns an empty string for a missing run', () => {
    expect(formatRunDuration(null)).toBe('');
  });
});

describe('formatRunStatusLabel', () => {
  test('maps known statuses to display labels', () => {
    expect(formatRunStatusLabel('failed')).toBe('Failed');
    expect(formatRunStatusLabel('succeeded')).toBe('Succeeded');
    expect(formatRunStatusLabel('running')).toBe('Running');
  });

  test('falls back to the raw value for an unknown status', () => {
    expect(formatRunStatusLabel('mystery')).toBe('mystery');
  });
});

describe('buildTimelineRows', () => {
  const run = { startedAt: '2026-09-23T12:04:00.000Z' };

  test('computes a clock-time label from run.startedAt + the row offset', () => {
    const rows = buildTimelineRows(run, [{ name: 'a', startOffsetMs: 60000, durationMs: 100, status: 'succeeded', errorCount: 0 }]);
    expect(new Date(run.startedAt).getTime() + 60000).toBe(new Date('2026-09-23T12:05:00.000Z').getTime());
    expect(rows[0].clockTime).toBeTruthy();
  });

  test('assigns error dot color for a failed step', () => {
    const rows = buildTimelineRows(run, [{ name: 'a', startOffsetMs: 0, durationMs: 1, status: 'failed', errorCount: 1 }]);
    expect(rows[0].dotColor).toBe('error');
  });

  test('assigns warning dot color for a succeeded step with warnings', () => {
    const rows = buildTimelineRows(run, [{ name: 'a', startOffsetMs: 0, durationMs: 1, status: 'succeeded', errorCount: 0, warnCount: 1 }]);
    expect(rows[0].dotColor).toBe('warning');
  });

  test('assigns success dot color for a clean succeeded step', () => {
    const rows = buildTimelineRows(run, [{ name: 'a', startOffsetMs: 0, durationMs: 1, status: 'succeeded', errorCount: 0 }]);
    expect(rows[0].dotColor).toBe('success');
  });

  test('returns an empty array for no timeline', () => {
    expect(buildTimelineRows(run, [])).toEqual([]);
    expect(buildTimelineRows(run, undefined)).toEqual([]);
  });
});

describe('sortDiffRows', () => {
  test('sorts severe before moderate before info', () => {
    const rows = [{ severity: 'info', field: 'c' }, { severity: 'severe', field: 'a' }, { severity: 'moderate', field: 'b' }];
    expect(sortDiffRows(rows).map((r) => r.field)).toEqual(['a', 'b', 'c']);
  });

  test('returns an empty array for undefined input', () => {
    expect(sortDiffRows(undefined)).toEqual([]);
  });
});

describe('bandLabel', () => {
  test('maps known band keys to display labels', () => {
    expect(bandLabel('outcomes')).toBe('Changed outcomes');
    expect(bandLabel('unchanged')).toBe('Unchanged / low-signal fields');
  });
});

describe('formatDiffValue', () => {
  test('renders undefined/null/empty as an em dash', () => {
    expect(formatDiffValue(undefined)).toBe('—');
    expect(formatDiffValue(null)).toBe('—');
    expect(formatDiffValue('')).toBe('—');
  });

  test('stringifies a real value', () => {
    expect(formatDiffValue(214)).toBe('214');
    expect(formatDiffValue('failed')).toBe('failed');
  });

  test('pretty-prints a plain object as JSON', () => {
    const result = formatDiffValue({ status: 'failed', code: 503 });
    expect(result).toContain('"status": "failed"');
    expect(result).toContain('"code": 503');
  });

  test('pretty-prints an array of objects as JSON', () => {
    const result = formatDiffValue([{ title: 'Section A' }, { title: 'Section B' }]);
    expect(result).toContain('"title": "Section A"');
    expect(result).toContain('"title": "Section B"');
    expect(result).not.toContain('[object Object]');
  });

  test('truncates very large objects at 800 chars', () => {
    const big = { data: 'x'.repeat(900) };
    const result = formatDiffValue(big);
    expect(result.length).toBeLessThanOrEqual(803); // 800 + '\n…'
    expect(result.endsWith('\n…')).toBe(true);
  });
});

describe('mergeRunLog', () => {
  test('merges lists chronologically and dedupes by _id', () => {
    const a = { _id: 'a', ts: '2026-10-04T10:00:03Z' };
    const b = { _id: 'b', ts: '2026-10-04T10:00:01Z' };
    const c = { _id: 'c', ts: '2026-10-04T10:00:02Z' };
    expect(mergeRunLog([a, c], [b, c]).map((e) => e._id)).toEqual(['b', 'c', 'a']);
  });
  test('breaks timestamp ties by _id and tolerates missing lists', () => {
    const x = { _id: 'x', ts: '2026-10-04T10:00:00Z' };
    const y = { _id: 'y', ts: '2026-10-04T10:00:00Z' };
    expect(mergeRunLog([y], undefined, [x]).map((e) => e._id)).toEqual(['x', 'y']);
  });
});

describe('formatCaptureLabel', () => {
  test('labels only runs that were actually captured', () => {
    expect(formatCaptureLabel({ captureMode: 'verbose' })).toBe('Verbose capture');
    expect(formatCaptureLabel({ captureMode: 'retain-on-failure' })).toBe('Capture on failure');
  });
  test('no label for a normal run or a missing run', () => {
    expect(formatCaptureLabel({})).toBe('');
    expect(formatCaptureLabel({ captureMode: 'normal' })).toBe('');
    expect(formatCaptureLabel(null)).toBe('');
  });
});

describe('pickRunInput', () => {
  test('prefers the curated input (summary and/or details)', () => {
    const run = { input: { summary: ' Doc Type: STD ', details: { docType: 'STD' } }, manifest: { inputs: { templateName: 't' } } };
    expect(pickRunInput(run)).toEqual({ kind: 'curated', summary: 'Doc Type: STD', details: { docType: 'STD' } });
    expect(pickRunInput({ input: { summary: 'only a summary' } })).toEqual({ kind: 'curated', summary: 'only a summary', details: null });
    expect(pickRunInput({ input: { details: { a: 1 } } })).toEqual({ kind: 'curated', summary: '', details: { a: 1 } });
  });

  test('falls back to the technical manifest inputs when there is no curated input', () => {
    expect(pickRunInput({ manifest: { inputs: { templateName: 't', project: 'P' } } })).toEqual({
      kind: 'technical',
      summary: '',
      details: { templateName: 't', project: 'P' },
    });
  });

  test('nothing to show for a run with neither, and tolerates odd shapes', () => {
    expect(pickRunInput(null)).toBeNull();
    expect(pickRunInput({})).toBeNull();
    expect(pickRunInput({ input: { summary: '  ', details: [1, 2] }, manifest: { inputs: {} } })).toBeNull();
    expect(pickRunInput({ input: { details: 'text' }, manifest: { inputs: [] } })).toBeNull();
  });
});

