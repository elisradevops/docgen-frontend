// Encrypts SharePoint auth (Graph token / NTLM password) before it's ever
// written to storage — previously stored as plaintext (Graph token) or a
// bare base64() (NTLM password, trivially reversible, not encryption).
//
// The AES-GCM key is generated once and persisted via indexedDbKeyStore.js
// (see that file — the key survives a page refresh, unlike a bare
// in-memory variable, while never being exposed as a readable string
// anywhere). A ciphertext that fails to decrypt under the current key
// (corrupted, or genuinely from a different browser profile) must be
// treated by callers as a cache-miss, not an error to surface.
//
// Note on overall posture: the raw key material is still never readable
// as plaintext (that part is unchanged). But combined with the NTLM
// credentials now living in localStorage with no time cap, a durable
// non-extractable key in IndexedDB plus durable ciphertext in
// localStorage means an offline attacker with access to this browser
// profile now has both at rest indefinitely — a materially weaker
// posture than the original all-ephemeral (in-memory key, nothing
// durable) design. This is an explicit, user-approved tradeoff (see the
// plan's Part A3), not an unchanged security property.
import { getOrCreateKey, clearKey } from './indexedDbKeyStore';

// Cheap, synchronous check — no key operation attempted. Lets a caller warn
// the user proactively (e.g. before they connect) rather than only finding
// out reactively when encryptForSession() throws after the fact. True
// mainly fails when the page is served over plain http:// (not localhost) —
// Web Crypto requires a secure context, a browser restriction no code here
// can work around.
export function isSecureStorageAvailable() {
  return !!globalThis.crypto?.subtle && !!globalThis.indexedDB;
}

let keyPromise = null;

function getKey() {
  if (!keyPromise) {
    if (!globalThis.crypto?.subtle) {
      throw new Error('Web Crypto unavailable (requires a secure context / HTTPS)');
    }
    keyPromise = getOrCreateKey().catch((err) => {
      keyPromise = null; // don't cache the failure — allow a retry on next use
      throw err;
    });
  }
  return keyPromise;
}

export async function clearSessionKey() {
  keyPromise = null;
  await clearKey();
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptForSession(plainText) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV size
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return JSON.stringify({
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipherBuffer)),
  });
}

export async function decryptForSession(cipherText) {
  const key = await getKey();
  const { iv, data } = JSON.parse(cipherText);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(data)
  );

  return new TextDecoder().decode(plainBuffer);
}
