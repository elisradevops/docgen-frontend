import { describe, expect, test, vi, beforeEach } from 'vitest';

// secureStorage.js now delegates key persistence to indexedDbKeyStore.js
// (real IndexedDB, unavailable in this repo's Node-based Vitest env). Mock
// it here so these tests keep verifying secureStorage's own encrypt/decrypt
// logic (which IS testable — crypto.subtle is a real Node global) without
// needing a real IndexedDB. The actual "survives a refresh" behavior is
// indexedDbKeyStore's own contract and is verified manually against the
// running dev stack (see Task 1's notes and the plan's Part A verification).
let mockStoredKey = null;
vi.mock('./indexedDbKeyStore', () => ({
  getOrCreateKey: vi.fn(async () => {
    if (!mockStoredKey) {
      mockStoredKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    return mockStoredKey;
  }),
  clearKey: vi.fn(async () => {
    mockStoredKey = null;
  }),
}));

import { encryptForSession, decryptForSession, clearSessionKey } from './secureStorage';

describe('encryptForSession / decryptForSession', () => {
  beforeEach(() => {
    mockStoredKey = null;
  });

  test('round-trips a plaintext string', async () => {
    const cipherText = await encryptForSession('super-secret-token');
    const plainText = await decryptForSession(cipherText);

    expect(plainText).toBe('super-secret-token');
  });

  test('round-trips a JSON payload (the actual call-site shape)', async () => {
    const payload = JSON.stringify({ accessToken: 'abc.def.ghi', timestamp: 1700000000000 });
    const cipherText = await encryptForSession(payload);
    const plainText = await decryptForSession(cipherText);

    expect(JSON.parse(plainText)).toEqual({ accessToken: 'abc.def.ghi', timestamp: 1700000000000 });
  });

  test('produces different ciphertext for the same plaintext on repeated calls (fresh IV each time)', async () => {
    const a = await encryptForSession('same-value');
    const b = await encryptForSession('same-value');

    expect(a).not.toBe(b);
  });

  test('rejects garbage/tampered ciphertext rather than returning wrong plaintext', async () => {
    await expect(decryptForSession('not-valid-ciphertext-json')).rejects.toThrow();
  });

  test('clearSessionKey forces a new key to be generated on next use', async () => {
    const cipherText = await encryptForSession('secret');
    await clearSessionKey();
    // After clearing, the in-memory promise cache is reset and a fresh key
    // is generated on next use (mockStoredKey was nulled by clearKey()).
    await expect(decryptForSession(cipherText)).rejects.toThrow();
  });
});
