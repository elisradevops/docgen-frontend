// Centralized, namespaced storage helpers
// Goal: prevent collisions across organizations/users by prefixing keys with app + org slug

function getCookie(name) {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  } catch {}
  return '';
}

function toOrgSlug(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Use host + first path segment as org hint (covers dev.azure.com/{org})
    const seg = (u.pathname || '/').split('/').filter(Boolean)[0] || '';
    const base = [u.hostname, seg].filter(Boolean).join('/');
    return base.replace(/[^a-z0-9/]+/gi, '-');
  } catch {
    return String(url).replace(/[^a-z0-9/]+/gi, '-');
  }
}

export function currentOrgSlug() {
  const orgUrl = getCookie('azuredevopsUrl');
  return toOrgSlug(orgUrl) || 'global';
}

export function makeKey(...parts) {
  const prefix = 'docgen';
  const org = currentOrgSlug();
  const cleaned = parts
    .filter((p) => p !== undefined && p !== null && `${p}`.length > 0)
    .map((p) => `${p}`.replace(/\s+/g, '-'));
  return [prefix, org, ...cleaned].join(':');
}

export function tryLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function tryLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function tryLocalStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

export function trySessionStorageGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function trySessionStorageSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

export function trySessionStorageRemove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}
