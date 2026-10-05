import { describe, expect, test, vi } from 'vitest';
import { enqueueRequest } from './requestQueue';

const timeoutError = () => Object.assign(new Error('timeout of 300000ms exceeded'), { code: 'ECONNABORTED' });

describe('enqueueRequest retry behaviour', () => {
  test('retries a timed-out request by default', async () => {
    const fn = vi.fn().mockRejectedValueOnce(timeoutError()).mockResolvedValueOnce('ok');
    await expect(enqueueRequest(fn, { key: 'retry-default' })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('never re-sends a request queued with retry: false', async () => {
    const fn = vi.fn().mockRejectedValue(timeoutError());
    await expect(enqueueRequest(fn, { key: 'retry-off', retry: false })).rejects.toThrow(/timeout/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retry: false also applies to retryable status codes', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 503 } });
    await expect(enqueueRequest(fn, { key: 'retry-off-503', retry: false })).rejects.toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
