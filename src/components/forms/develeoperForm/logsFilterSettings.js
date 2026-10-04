// Pure logic and localStorage helpers for LogsExplorer display settings.
// Kept separate from logsExplorerState.js so it can be tested without jsdom
// (same rationale as monitoringSummary.js).

import { makeKey, tryLocalStorageGet, tryLocalStorageSet } from '../../../utils/storage';

const STORAGE_KEY = 'logs-explorer-settings';

export const LOGS_FILTER_DEFAULTS = {
  defaultWindowHours: 24,
  defaultLevels: [],        // [] means "all levels"
  defaultServices: [],      // [] means "all services"
  excludePhrases: [],       // rows whose message contains any phrase are hidden
};

export function loadLogsFilterSettings() {
  try {
    const raw = tryLocalStorageGet(makeKey(STORAGE_KEY));
    if (!raw) return { ...LOGS_FILTER_DEFAULTS };
    return { ...LOGS_FILTER_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...LOGS_FILTER_DEFAULTS };
  }
}

export function saveLogsFilterSettings(settings) {
  tryLocalStorageSet(makeKey(STORAGE_KEY), JSON.stringify(settings));
}

/**
 * Returns true when the event should be hidden because its message contains
 * at least one of the exclude phrases (case-insensitive substring match).
 */
export function isEventExcluded(event, excludePhrases) {
  if (!excludePhrases?.length) return false;
  const msg = (event?.message ?? '').toLowerCase();
  return excludePhrases.some((p) => p && msg.includes(p.toLowerCase()));
}

