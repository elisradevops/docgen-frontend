// Decides and owns the SharePoint-session transport: standalone web app
// uses the __Host- session cookie (withCredentials + a CSRF header read
// back from a non-HttpOnly cookie); the ADO-embedded iframe uses an
// in-memory bearer handle instead, since third-party cookies are
// unreliable in that cross-site context. See the SharePoint OAuth design
// plan's §3.5 for why SameSite=None is mandatory and what that means for
// each transport.
import { isAdoEmbedded } from '../adoSdk';

// Must match cookies.ts's csrfCookieName on the backend exactly.
const CSRF_COOKIE_NAME = '__Host-docgen_csrf';

// Deliberately a plain module-level variable, never localStorage or
// sessionStorage — an XSS in the iframe can still read this while the page
// is open, but it never persists across a reload and is never written to
// any storage API an attacker could exfiltrate at leisure.
//
// Accepted tradeoff: this means an ADO-embedded (bearer-transport) user is
// signed out of SharePoint on every page refresh, even though the backend
// session/MSAL token cache is still valid — the frontend simply forgot the
// handle needed to reach it. Do NOT "fix" this by persisting the handle to
// storage; that reintroduces the exact XSS-exfiltration risk this design
// exists to prevent. Cookie-transport (standalone web) is unaffected — the
// __Host- session cookie survives a refresh on its own.
let bearerHandle = null;

export function getTransportMode() {
  return isAdoEmbedded() ? 'bearer' : 'cookie';
}

export function setBearerHandle(handle) {
  bearerHandle = handle || null;
}

export function clearBearerHandle() {
  bearerHandle = null;
}

export function hasBearerHandle() {
  return !!bearerHandle;
}

function readCsrfCookie() {
  if (typeof document === 'undefined' || !document.cookie) return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// The axios request-config fragment to spread into a SharePoint-session
// call. Deliberately per-call, not a global axios.defaults change — this
// codebase's ADO/MinIO calls use the same axios instance and must not pick
// up credentials/cookies meant only for the SharePoint session endpoints.
export function authRequestConfig() {
  if (getTransportMode() === 'bearer') {
    return bearerHandle ? { headers: { Authorization: `Bearer ${bearerHandle}` } } : {};
  }

  const csrfToken = readCsrfCookie();
  return {
    withCredentials: true,
    headers: csrfToken ? { 'X-Csrf-Token': csrfToken } : {},
  };
}
