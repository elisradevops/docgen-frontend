import { describe, expect, test } from 'vitest';
import { advanceTail, buildTailParams, initialTailState } from './liveTailState';

const page = (n, extra = {}) => ({ tail: true, events: Array.from({ length: n }, (_, i) => ({ _id: `id${i + 1}` })), ...extra });
const opts = { maxDrain: 3, limit: 5 };

describe('buildTailParams', () => {
  test('sends nothing until there is a boundary (the first poll just returns the newest page)', () => {
    expect(buildTailParams(initialTailState(), null)).toEqual({});
    expect(buildTailParams(initialTailState(), NaN)).toEqual({});
  });

  test('with a boundary: tail mode with the look-back time, no cursor yet', () => {
    expect(buildTailParams(initialTailState(), Date.parse('2026-10-06T10:00:00Z'))).toEqual({
      insertedAfter: '2026-10-06T10:00:00.000Z',
      tail: 'true',
    });
  });

  test('while draining it also sends the cursor', () => {
    const params = buildTailParams({ afterId: 'abc', drainStreak: 1 }, Date.parse('2026-10-06T10:00:00Z'));
    expect(params).toMatchObject({ tail: 'true', afterId: 'abc' });
  });
});

describe('advanceTail', () => {
  test('a full page keeps draining from its last event and counts the streak', () => {
    const r = advanceTail(initialTailState(), page(5), opts);
    expect(r).toMatchObject({ drainNext: true, stillBehind: false, behind: 0, tailed: true });
    expect(r.state).toEqual({ afterId: 'id5', drainStreak: 1 });
  });

  test('a short page means caught up: back to the look-back, no chip', () => {
    const r = advanceTail({ afterId: 'id5', drainStreak: 2 }, page(2, { behind: 0 }), opts);
    expect(r).toMatchObject({ drainNext: false, stillBehind: false, behind: 0 });
    expect(r.state).toEqual(initialTailState());
  });

  test('a full page after the drain limit is "still behind", with the count from the server', () => {
    const r = advanceTail({ afterId: 'id5', drainStreak: 3 }, page(5, { behind: 1200 }), opts);
    expect(r).toMatchObject({ drainNext: false, stillBehind: true, behind: 1200 });
    expect(r.state).toEqual(initialTailState());
  });

  test('draining stops exactly at the limit', () => {
    let state = initialTailState();
    const results = [];
    for (let i = 0; i < 5; i++) {
      const r = advanceTail(state, page(5, { behind: 10 }), opts);
      results.push(r.drainNext);
      state = r.state;
    }
    expect(results).toEqual([true, true, true, false, true]); // after the 4th the streak starts over
  });

  test('an api-gate without tail mode never drains and keeps the old overflow signal', () => {
    const legacy = { events: new Array(5).fill({ _id: 'x' }), matchedCount: 12 };
    const r = advanceTail(initialTailState(), legacy, opts);
    expect(r).toMatchObject({ drainNext: false, stillBehind: false, behind: 0, tailed: false, overflow: 7 });
  });

  test('the old overflow is not computed without a boundary', () => {
    const legacy = { events: [{ _id: 'x' }], matchedCount: 50 };
    expect(advanceTail(initialTailState(), legacy, { ...opts, hadBoundary: false }).overflow).toBe(0);
  });

  test('a tail response never reports the old overflow', () => {
    expect(advanceTail(initialTailState(), page(2, { matchedCount: 99 }), opts).overflow).toBe(0);
  });

  test('a malformed or empty response is treated as caught up', () => {
    expect(advanceTail(initialTailState(), undefined, opts)).toMatchObject({ drainNext: false, stillBehind: false, behind: 0 });
    expect(advanceTail(initialTailState(), { tail: true }, opts)).toMatchObject({ drainNext: false });
  });

  test('does not change the state it was given', () => {
    const state = { afterId: 'a', drainStreak: 1 };
    advanceTail(state, page(5), opts);
    expect(state).toEqual({ afterId: 'a', drainStreak: 1 });
  });
});
