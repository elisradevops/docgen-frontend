// The OAuth popup roundtrip, and nothing else. Entra's own login page
// refuses to be iframed, so the ADO-embedded app can't redirect its own
// iframe there — this opens a popup that performs the whole Authorization
// Code + PKCE roundtrip in its own top-level context, then reports the
// result back via postMessage. Every check below is a separate early
// return so each is independently testable — see the SharePoint OAuth
// design plan's §3.10 for the exact pitfalls each one exists to prevent.
const POPUP_FEATURES = 'width=520,height=680';
const RESULT_TYPE = 'docgen:sp-auth';
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;
const CLOSED_POLL_MS = 500;

function popupError(message, code) {
  return Object.assign(new Error(message), { code });
}

// Backend/Entra error codes are stable identifiers, not user-facing text —
// AADSTS-prefixed descriptions and internal codes like 'sign_in_failed'
// must never reach the dialog verbatim. Unrecognized codes fall back to a
// generic message rather than the raw code/description.
const ERROR_MESSAGES = {
  access_denied: 'Sign-in was cancelled.',
  consent_required: 'Additional permission is needed to sign in — contact your administrator.',
  missing_code: 'Sign-in couldn’t be completed. Please try again.',
  sign_in_failed: 'Sign-in couldn’t be completed. Please try again, or contact your administrator if this keeps happening.',
};
const DEFAULT_ERROR_MESSAGE = ERROR_MESSAGES.sign_in_failed;

function describeAuthError(code) {
  return ERROR_MESSAGES[code] || DEFAULT_ERROR_MESSAGE;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

// Must be called synchronously from within a user-gesture handler (a click
// callback with no prior `await`) or browsers will silently block the
// popup — that's exactly what the popup_blocked rejection surfaces.
export function openAuthPopup({ apiBaseUrl, mode, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const expectedOrigin = originOf(apiBaseUrl);
    const opener = typeof window !== 'undefined' ? window.location.origin : '';
    const modeParam = mode ? `&mode=${encodeURIComponent(mode)}` : '';
    const loginUrl = `${apiBaseUrl}/auth/login?opener=${encodeURIComponent(opener)}${modeParam}`;

    const popup = window.open(loginUrl, 'docgen-sp-auth', POPUP_FEATURES);
    if (!popup) {
      reject(popupError('Popup was blocked — allow popups for this site and try again', 'popup_blocked'));
      return;
    }

    let settled = false;
    let closedPollId;
    let timeoutId;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      clearInterval(closedPollId);
      clearTimeout(timeoutId);
    }

    function settle(fn) {
      if (settled) return; // single-consume: a later/duplicate message is ignored
      settled = true;
      cleanup();
      fn();
    }

    function onMessage(event) {
      // Exact string equality only — never startsWith/includes/endsWith,
      // all of which are bypassable by a lookalike or path-embedded origin.
      if (event.origin !== expectedOrigin) return;
      // Must come from the window this call opened, not any other frame.
      if (event.source !== popup) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== RESULT_TYPE) return;

      settle(() => {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
        if (data.ok) {
          resolve({ handleCode: data.handleCode });
        } else {
          const code = data.error || 'sign_in_failed';
          const error = popupError(describeAuthError(code), code);
          error.description = data.errorDescription;
          reject(error);
        }
      });
    }

    window.addEventListener('message', onMessage);

    closedPollId = setInterval(() => {
      if (popup.closed) {
        settle(() => reject(popupError('Sign-in window was closed before completing', 'popup_closed')));
      }
    }, CLOSED_POLL_MS);

    timeoutId = setTimeout(() => {
      settle(() => {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
        reject(popupError('Sign-in timed out', 'timeout'));
      });
    }, timeoutMs);
  });
}
