// The decision logic of the Logs live tail, kept pure so it can be tested without a browser: what the next
// poll asks for, and what a response means (keep draining a burst, give up and say it is behind, or go back
// to the look-back by time). useLiveTail runs it; it owns no timers and touches no state of its own.
import {
  computeLiveOverflow,
  isFullTailPage,
  liveBehind,
  tailCursorAfter,
  LIVE_MAX_DRAIN,
  LIVE_PAGE_LIMIT,
} from './logsExplorerState';

/** Where the tail continues from: after a FULL page, strictly after its last event (`afterId`). */
export const initialTailState = () => ({ afterId: null, drainStreak: 0 });

/**
 * The query parameters the tail adds to a poll. Tail mode needs a starting point, so until there is a
 * boundary (no server time and nothing on screen) none are sent and the poll just returns the newest page.
 * An api-gate without tail mode ignores them and answers the old way.
 */
export const buildTailParams = (state, boundaryMs) => {
  if (!Number.isFinite(boundaryMs)) return {};
  const params = { insertedAfter: new Date(boundaryMs).toISOString(), tail: 'true' };
  if (state.afterId) params.afterId = state.afterId;
  return params;
};

/**
 * What a poll response means.
 *  - A full tail page (and the streak is below `maxDrain`): keep draining, continuing after its last event.
 *  - Otherwise the tail is caught up, or a whole drain run could not catch up: back to the look-back by time.
 *    `stillBehind` is only true in the second case, because right after a full page the count still includes
 *    events re-read from the look-back and would flicker while the tail is in fact keeping up.
 *  - A response without `tail: true` (an api-gate that predates tail mode) never drains and keeps the old
 *    "+N more events" overflow signal.
 */
export const advanceTail = (state, response, { hadBoundary = true, maxDrain = LIVE_MAX_DRAIN, limit = LIVE_PAGE_LIMIT } = {}) => {
  const tailed = response?.tail === true;
  const full = tailed && isFullTailPage(response, limit);
  if (full && state.drainStreak < maxDrain) {
    return {
      state: { afterId: tailCursorAfter(response), drainStreak: state.drainStreak + 1 },
      drainNext: true,
      stillBehind: false,
      behind: 0,
      overflow: 0,
      tailed,
    };
  }
  return {
    state: initialTailState(),
    drainNext: false,
    stillBehind: full,
    behind: full ? liveBehind(response) : 0,
    overflow: hadBoundary && !tailed ? computeLiveOverflow(response?.matchedCount, response?.events?.length ?? 0) : 0,
    tailed,
  };
};
