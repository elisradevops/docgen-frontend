// IndexedDB-backed persistence for the SharePoint auth encryption key —
// survives a page refresh (sessionStorage's ciphertext does; a bare
// in-memory key does not, since JS re-executes fully on every reload).
// The CryptoKey object itself is stored via structured clone — IndexedDB
// supports storing actual (even non-extractable) CryptoKey instances, so
// the raw key material is never exposed as a readable string anywhere
// (that part is unchanged from the original in-memory design). No
// TTL/expiry on the key itself — it lives until clearKey() is called (on
// explicit Disconnect).
//
// This is NOT the same overall security posture as before, though.
// Originally the key existed only in JS memory and died on every reload,
// so nothing decryptable was ever at rest. Now, combined with the NTLM
// credentials living in localStorage with no time cap, a durable
// non-extractable key here plus durable ciphertext in localStorage means
// an offline attacker with access to this browser profile has both at
// rest indefinitely — weaker than the all-ephemeral original. This was
// an explicit, user-approved tradeoff (see the plan's Part A3).

const DB_NAME = 'docgen-sharepoint-auth';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_RECORD_ID = 'sharepoint-session-key';

function assertIndexedDbAvailable() {
  if (!globalThis.indexedDB) {
    throw new Error('IndexedDB unavailable in this browser context');
  }
}

function openDb() {
  assertIndexedDbAvailable();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readRecord(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY_RECORD_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function writeRecord(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(record, KEY_RECORD_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteRecord(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(KEY_RECORD_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getOrCreateKey() {
  const db = await openDb();
  const existing = await readRecord(db);
  if (existing?.key) {
    return existing.key;
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await writeRecord(db, { key });
  return key;
}

export async function clearKey() {
  const db = await openDb();
  await deleteRecord(db);
}
