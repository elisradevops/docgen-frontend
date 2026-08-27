import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { openAuthPopup } from './authPopup';

const API_BASE_URL = 'https://api.docgen.example.com';

function createFakePopup() {
  return { closed: false, close: vi.fn() };
}

function createFakeWindow({ openReturns } = {}) {
  const listeners = {};
  return {
    open: vi.fn(() => openReturns),
    location: { origin: 'https://app.docgen.example.com' },
    addEventListener: vi.fn((type, handler) => {
      listeners[type] = handler;
    }),
    removeEventListener: vi.fn((type) => {
      delete listeners[type];
    }),
    __listeners: listeners,
  };
}

describe('openAuthPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects with popup_blocked when window.open returns null (popup blocker)', async () => {
    const fakeWindow = createFakeWindow({ openReturns: null });
    vi.stubGlobal('window', fakeWindow);

    await expect(openAuthPopup({ apiBaseUrl: API_BASE_URL })).rejects.toMatchObject({ code: 'popup_blocked' });
  });

  it('resolves with the handleCode on a valid, matching-origin, matching-source message', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL });
    fakeWindow.__listeners.message({
      origin: API_BASE_URL,
      source: popup,
      data: { type: 'docgen:sp-auth', ok: true, handleCode: 'the-code' },
    });

    await expect(promise).resolves.toEqual({ handleCode: 'the-code' });
    expect(popup.close).toHaveBeenCalled();
  });

  it('rejects with a friendly message for a recognized server error code, preserving the raw code', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL });
    fakeWindow.__listeners.message({
      origin: API_BASE_URL,
      source: popup,
      data: { type: 'docgen:sp-auth', ok: false, error: 'access_denied', errorDescription: 'AADSTS65004: ...' },
    });

    await expect(promise).rejects.toMatchObject({
      code: 'access_denied',
      message: 'Sign-in was cancelled.',
      description: 'AADSTS65004: ...',
    });
  });

  it('falls back to a generic message for an unrecognized server error code, never showing the raw code', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL });
    fakeWindow.__listeners.message({
      origin: API_BASE_URL,
      source: popup,
      data: { type: 'docgen:sp-auth', ok: false, error: 'some_future_backend_code' },
    });

    await expect(promise).rejects.toMatchObject({
      code: 'some_future_backend_code',
      message: expect.not.stringContaining('some_future_backend_code'),
    });
  });

  it('ignores a message from the wrong origin', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL, timeoutMs: 50 });
    fakeWindow.__listeners.message({
      origin: 'https://attacker.example.com',
      source: popup,
      data: { type: 'docgen:sp-auth', ok: true, handleCode: 'stolen-code' },
    });

    vi.advanceTimersByTime(60);
    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
  });

  it('ignores a message with the right origin but the wrong event.source (not the window we opened)', async () => {
    const popup = createFakePopup();
    const otherWindow = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL, timeoutMs: 50 });
    fakeWindow.__listeners.message({
      origin: API_BASE_URL,
      source: otherWindow,
      data: { type: 'docgen:sp-auth', ok: true, handleCode: 'wrong-source-code' },
    });

    vi.advanceTimersByTime(60);
    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
  });

  it('ignores a message missing the type discriminator', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL, timeoutMs: 50 });
    fakeWindow.__listeners.message({ origin: API_BASE_URL, source: popup, data: { ok: true, handleCode: 'x' } });

    vi.advanceTimersByTime(60);
    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
  });

  it('ignores a non-object data payload without throwing', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL, timeoutMs: 50 });
    expect(() => fakeWindow.__listeners.message({ origin: API_BASE_URL, source: popup, data: 'not-an-object' })).not.toThrow();

    vi.advanceTimersByTime(60);
    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
  });

  it('single-consume: a second valid message after resolution is ignored (removeEventListener actually called)', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL });
    fakeWindow.__listeners.message({
      origin: API_BASE_URL,
      source: popup,
      data: { type: 'docgen:sp-auth', ok: true, handleCode: 'first-code' },
    });
    await promise;

    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));

    // A duplicate/replayed message must not throw or resolve/reject again —
    // the listener was already removed, so directly re-invoking the
    // captured handler function simulates "if it somehow still fired".
    expect(() =>
      fakeWindow.__listeners.message?.({
        origin: API_BASE_URL,
        source: popup,
        data: { type: 'docgen:sp-auth', ok: true, handleCode: 'second-code' },
      })
    ).not.toThrow();
  });

  it('rejects with popup_closed when the popup is closed before completing', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL });
    popup.closed = true;
    vi.advanceTimersByTime(600);

    await expect(promise).rejects.toMatchObject({ code: 'popup_closed' });
  });

  it('rejects with timeout when no message arrives within the timeout window', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    const promise = openAuthPopup({ apiBaseUrl: API_BASE_URL, timeoutMs: 1000 });
    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
    expect(popup.close).toHaveBeenCalled();
  });

  it('opens the popup with the caller\'s own origin as the opener query param', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    openAuthPopup({ apiBaseUrl: API_BASE_URL });

    const [url] = fakeWindow.open.mock.calls[0];
    expect(url).toContain(`${API_BASE_URL}/auth/login?opener=`);
    expect(url).toContain(encodeURIComponent('https://app.docgen.example.com'));
  });

  it('includes mode=ado in the login URL when mode is passed', async () => {
    const popup = createFakePopup();
    const fakeWindow = createFakeWindow({ openReturns: popup });
    vi.stubGlobal('window', fakeWindow);

    openAuthPopup({ apiBaseUrl: API_BASE_URL, mode: 'ado' });

    const [url] = fakeWindow.open.mock.calls[0];
    expect(url).toContain('mode=ado');
  });
});
