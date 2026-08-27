// App-facing façade over the popup + transport plumbing — TemplatesTab and
// SharePointConnectDialog talk to this module only, never to authPopup.js
// or authTransport.js directly.
import axios from 'axios';
import C from '../store/constants';
import { openAuthPopup } from './authPopup';
import { getTransportMode, setBearerHandle, clearBearerHandle, authRequestConfig } from './authTransport';

const baseHeaders = { 'Content-Type': 'application/json' };

export async function signIn() {
  const mode = getTransportMode() === 'bearer' ? 'ado' : undefined;
  const { handleCode } = await openAuthPopup({ apiBaseUrl: C.jsonDocument_url, mode });

  // Cookie mode: the callback already set the session+CSRF cookies at the
  // BFF origin during the popup roundtrip — nothing left to do here.
  if (getTransportMode() === 'bearer') {
    const response = await axios.post(
      `${C.jsonDocument_url}/auth/session/exchange`,
      { handleCode },
      { headers: baseHeaders }
    );
    setBearerHandle(response.data.sessionToken);
  }
}

export async function getSessionInfo() {
  const response = await axios.get(`${C.jsonDocument_url}/auth/session`, {
    headers: baseHeaders,
    ...authRequestConfig(),
  });
  return response.data;
}

export async function signOut() {
  try {
    await axios.post(`${C.jsonDocument_url}/auth/logout`, {}, { headers: baseHeaders, ...authRequestConfig() });
  } finally {
    // Always clear the local bearer handle, even if the network call
    // fails — an unreachable backend must not leave the UI believing it's
    // still signed in.
    clearBearerHandle();
  }
}

// Two error shapes can reach here: a raw axios error (from this module's
// own calls, e.g. getSessionInfo) still has `.response.status`/`.data.error`
// intact; an error surfaced through docManagerApi.jsx's SharePoint
// functions has already been unwrapped/rewrapped (see
// docManagerApi.jsx's wrapSharePointError) into a plain Error with
// `.status`/`.code` instead — check both.
export function isReauthRequired(error) {
  if (error?.response?.status === 401 && error?.response?.data?.error === 'reauth_required') return true;
  if (error?.status === 401 && error?.code === 'reauth_required') return true;
  return false;
}
