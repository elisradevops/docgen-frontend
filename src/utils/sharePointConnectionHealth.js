// Live health-check for the app-level SharePoint connection shown in
// TemplatesTab. Online now authenticates via a server-side BFF session
// (see sharePointSession.js) — its health is judged by the session
// endpoint itself (401 reauth_required is the authoritative signal), not
// by anything cached client-side. Only on-prem NTLM credentials are still
// cached in this browser and checked here: an NTLM password carries no
// expiry signal of its own, so it can only be judged stale by an actual
// live test call.
import { decryptForSession } from './secureStorage';

export const HEALTH_CHECK_INTERVAL_MS = 30 * 1000;

export const isOnlineSharePointUrl = (url) => !!url && url.toLowerCase().includes('.sharepoint.com');

// Reads cached on-prem NTLM credentials from this browser, if any. Returns
// null when nothing usable is cached — including for Online configs, which
// never cache anything here anymore.
export async function readCachedOnPremCredentials() {
  const cachedCredsRaw = localStorage.getItem('sharepoint_credentials');
  if (!cachedCredsRaw) return null;

  try {
    const creds = JSON.parse(await decryptForSession(cachedCredsRaw));
    if (creds?.username && creds?.password) {
      return {
        type: 'onprem',
        auth: { username: creds.username, password: creds.password, domain: creds.domain || '' },
        expiredLocally: false, // NTLM has no local expiry signal — only a live call can tell.
      };
    }
  } catch {
    // Corrupted/undecryptable cache — treat as no cached auth.
  }
  return null;
}

// Pure — maps a health status to what the status card should show.
export function describeConnectionHealth(status) {
  switch (status) {
    case 'healthy':
      return { severity: 'success', message: '✓ Connected' };
    case 'healthy-unsaved':
      // On-prem only: a working connection for this tab, but nothing was
      // persisted to storage (Remember wasn't checked, or this browser
      // context can't use Web Crypto) — distinct from 'no-session' so a
      // real, currently-working connection never reads as "reconnect to
      // sync".
      return {
        severity: 'info',
        message: "✓ Connected (this browser can't remember the session — you'll need to reconnect after refreshing)",
      };
    case 'unhealthy':
      return { severity: 'error', message: '⚠ Session expired — reconnect to sync' };
    case 'requires-relink':
      // Online only: this saved connection predates sharing-link-only
      // Online auth and can't be resolved as-is — see the SharePoint OAuth
      // design plan's relink migration.
      return {
        severity: 'warning',
        message: '⚠ This connection needs to be re-linked with a SharePoint sharing link',
      };
    case 'checking':
      return { severity: 'info', message: 'Verifying connection…' };
    case 'no-session':
    default:
      return { severity: 'warning', message: 'No active session in this browser — reconnect to sync' };
  }
}
