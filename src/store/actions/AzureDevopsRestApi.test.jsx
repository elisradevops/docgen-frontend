import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('axios');

vi.mock('../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/debug', () => ({
  setLastApiError: vi.fn(),
}));

vi.mock('../../utils/requestQueue', () => ({
  enqueueRequest: vi.fn((fn) => fn()),
}));

// Regression coverage for _wrap's suppressAuthHandler option — the single
// line in this plan whose consequence, if it regresses, is signing a real
// user out of the app. suppressAuthHandler must be opt-in: its absence must
// still escalate a 401 to the global auth handler (this protects the other
// ~22 _wrap call sites in this file), and only an explicit
// suppressAuthHandler: true (used today by getWindowsIdentity, a
// best-effort/low-stakes call) may suppress that escalation.
describe('AzureDevopsRestApi._wrap suppressAuthHandler', () => {
  let handler;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      APP_CONFIG: {
        JSON_DOCUMENT_URL: 'http://api-gate',
      },
    });
    handler = vi.fn();
  });

  test('control: a 401 with no suppressAuthHandler still triggers the global auth handler', async () => {
    const { default: AzureDevopsRestApi, setAuthErrorHandler } = await import('./AzureDevopsRestApi.jsx');
    setAuthErrorHandler(handler);

    const api = new AzureDevopsRestApi('https://org', 'pat');
    const err = new Error('unauthorized');
    err.status = 401;

    await expect(api._wrap(async () => { throw err; })).rejects.toThrow('unauthorized');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(err);
  });

  test('opt-in: suppressAuthHandler:true suppresses the global auth handler for the same 401', async () => {
    const { default: AzureDevopsRestApi, setAuthErrorHandler } = await import('./AzureDevopsRestApi.jsx');
    setAuthErrorHandler(handler);

    const api = new AzureDevopsRestApi('https://org', 'pat');
    const err = new Error('unauthorized');
    err.status = 401;

    await expect(
      api._wrap(async () => { throw err; }, { suppressAuthHandler: true })
    ).rejects.toThrow('unauthorized');

    expect(handler).not.toHaveBeenCalled();
  });
});
