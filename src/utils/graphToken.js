// Best-effort, unverified read of a Microsoft Graph access token's `exp`
// claim — display-only (e.g. "expires in 47m" in the credentials dialog).
// This process has no way to verify an Entra-issued token's signature, and
// doesn't need to: the token is only ever sent straight to Graph, which does
// its own verification. Returns null for a non-JWT/opaque token or any
// malformed segment — callers must treat that as "unknown", not "expired".
export function decodeJwtExpirySeconds(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;

  try {
    const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const claims = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    const exp = claims.exp;
    if (typeof exp !== 'number') return null;
    return Math.max(0, Math.round(exp - Date.now() / 1000));
  } catch {
    return null;
  }
}

export function formatTokenExpiry(seconds) {
  if (seconds === null) return null;
  if (seconds <= 0) return 'expired';
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? 'expires in under a minute' : `expires in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
