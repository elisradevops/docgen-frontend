// Live health-check for the app-level SharePoint connection shown in
// TemplatesTab — distinguishes what's actually verifiable for each
// connection type: a Graph token carries its own real expiry (checkable
// locally, no network call), while an NTLM password has no such signal and
// can only be judged stale by an actual live test call.
import { decryptForSession } from './secureStorage';
import { decodeJwtExpirySeconds } from './graphToken';

export const HEALTH_CHECK_INTERVAL_MS = 30 * 1000;

export const isOnlineSharePointUrl = (url) => !!url && url.toLowerCase().includes('.sharepoint.com');

// Reads whichever SharePoint auth is cached in this browser (if any) and
// reports enough about it to judge health without necessarily needing a
// network call yet. Returns null when nothing usable is cached here.
export async function readCachedSharePointAuth() {
  const cachedTokenRaw = localStorage.getItem('sharepoint_oauth_token');
  if (cachedTokenRaw) {
    try {
      const tokenData = JSON.parse(await decryptForSession(cachedTokenRaw));
      if (tokenData?.accessToken) {
        const remainingSeconds = decodeJwtExpirySeconds(tokenData.accessToken);
        return {
          type: 'online',
          auth: { accessToken: tokenData.accessToken },
          expiredLocally: remainingSeconds !== null && remainingSeconds <= 0,
        };
      }
    } catch {
      // Corrupted/undecryptable cache — treat as no cached auth.
    }
  }

  const cachedCredsRaw = localStorage.getItem('sharepoint_credentials');
  if (cachedCredsRaw) {
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
  }

  return null;
}

// Pure — maps a health status to what the status card should show.
export function describeConnectionHealth(status) {
  switch (status) {
    case 'healthy':
      return { severity: 'success', message: '✓ Connected' };
    case 'healthy-unsaved':
      // Working connection for this tab, but nothing was persisted to
      // storage (Remember wasn't checked, or this browser context can't
      // use Web Crypto) — distinct from 'no-session' so a real, currently-
      // working connection never reads as "reconnect to sync".
      return {
        severity: 'info',
        message: "✓ Connected (this browser can't remember the session — you'll need to reconnect after refreshing)",
      };
    case 'unhealthy':
      return { severity: 'error', message: '⚠ Session expired — reconnect to sync' };
    case 'checking':
      return { severity: 'info', message: 'Verifying connection…' };
    case 'no-session':
    default:
      return { severity: 'warning', message: 'No active session in this browser — reconnect to sync' };
  }
}
