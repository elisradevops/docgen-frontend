import { describe, expect, test, vi } from 'vitest';
import { LOGS_FILTER_DEFAULTS, isEventExcluded } from './logsFilterSettings';

// Storage module is side-effectful (reads localStorage); mock it so the pure
// logic tests don't depend on a DOM environment.
vi.mock('../../../utils/storage', () => ({
  makeKey: (...parts) => parts.join(':'),
  tryLocalStorageGet: vi.fn(() => null),
  tryLocalStorageSet: vi.fn(),
}));

describe('LOGS_FILTER_DEFAULTS', () => {
  test('has an empty exclude list so no rows are hidden by default', () => {
    expect(LOGS_FILTER_DEFAULTS.excludePhrases).toEqual([]);
  });
});

describe('isEventExcluded', () => {
  test('returns false when excludePhrases is empty', () => {
    expect(isEventExcluded({ message: 'Executing action' }, [])).toBe(false);
  });

  test('returns true when message contains an exclude phrase (case-insensitive)', () => {
    expect(isEventExcluded({ message: 'Executing action method XYZ' }, ['executing action'])).toBe(true);
  });

  test('returns false when message does not match any phrase', () => {
    expect(isEventExcluded({ message: 'Error occurred' }, ['executing action'])).toBe(false);
  });

  test('returns false when event has no message', () => {
    expect(isEventExcluded({}, ['timeout'])).toBe(false);
    expect(isEventExcluded({ message: null }, ['timeout'])).toBe(false);
  });

  test('ignores blank phrases in the list', () => {
    expect(isEventExcluded({ message: 'Hello' }, ['', '  '])).toBe(false);
  });

  test('matches any one of multiple phrases', () => {
    expect(isEventExcluded({ message: 'Request finished in 3ms' }, ['executing', 'request finished'])).toBe(true);
  });
});

