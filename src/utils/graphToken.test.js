import { describe, expect, test } from 'vitest';
import { decodeJwtExpirySeconds, formatTokenExpiry } from './graphToken';

function makeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('decodeJwtExpirySeconds', () => {
  test('returns a positive remaining-lifetime for a token expiring in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const seconds = decodeJwtExpirySeconds(makeJwt({ exp }));

    expect(seconds).toBeGreaterThan(290);
    expect(seconds).toBeLessThanOrEqual(300);
  });

  test('clamps to 0 for a token that already expired, never returning negative', () => {
    const exp = Math.floor(Date.now() / 1000) - 300;
    const seconds = decodeJwtExpirySeconds(makeJwt({ exp }));

    expect(seconds).toBe(0);
  });

  test('returns null for a non-JWT string (not three dot-separated segments)', () => {
    expect(decodeJwtExpirySeconds('not-a-jwt')).toBeNull();
    expect(decodeJwtExpirySeconds('')).toBeNull();
  });

  test('returns null for a malformed payload segment rather than throwing', () => {
    expect(decodeJwtExpirySeconds('header.not-base64-json.sig')).toBeNull();
  });

  test('returns null when the payload has no numeric exp claim', () => {
    expect(decodeJwtExpirySeconds(makeJwt({ sub: 'user' }))).toBeNull();
  });
});

describe('formatTokenExpiry', () => {
  test('returns null when the input is null (unknown lifetime)', () => {
    expect(formatTokenExpiry(null)).toBeNull();
  });

  test('reports "expired" for zero or negative seconds', () => {
    expect(formatTokenExpiry(0)).toBe('expired');
  });

  test('reports "under a minute" for a very short remaining lifetime', () => {
    expect(formatTokenExpiry(20)).toBe('expires in under a minute');
  });

  test('reports whole minutes, singular vs plural', () => {
    expect(formatTokenExpiry(60)).toBe('expires in 1 minute');
    expect(formatTokenExpiry(300)).toBe('expires in 5 minutes');
  });
});
