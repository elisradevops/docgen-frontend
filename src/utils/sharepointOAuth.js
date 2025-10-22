import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce';

// Get Azure AD config from runtime window config (injected by nginx entrypoint)
const AZURE_CLIENT_ID = window.APP_CONFIG?.AZURE_CLIENT_ID;
const AZURE_TENANT_ID = window.APP_CONFIG?.AZURE_TENANT_ID || 'common';

if (!AZURE_CLIENT_ID) {
  console.error('AZURE_CLIENT_ID not configured. Set AZURE_CLIENT_ID environment variable in your deployment.');
}

/**
 * Initiates OAuth login flow for SharePoint
 * Opens popup window and returns a promise that resolves with the access token
 */
export async function loginWithSharePointOAuth(siteUrl) {
  // Generate PKCE parameters first (outside Promise)
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  return new Promise((resolve, reject) => {
    try {

      // Store verifier and state in sessionStorage (needed for token exchange)
      sessionStorage.setItem(`oauth_verifier_${state}`, codeVerifier);
      sessionStorage.setItem(`oauth_siteurl_${state}`, siteUrl);

      // Extract resource from site URL
      const url = new URL(siteUrl);
      const resource = `https://${url.hostname}`;

      // Build authorization URL
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const authUrl = new URL(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`);
      authUrl.searchParams.append('client_id', AZURE_CLIENT_ID);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_mode', 'query');
      authUrl.searchParams.append('scope', `${resource}/.default offline_access`);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');

      // Open popup window
      const popup = window.open(
        authUrl.toString(),
        'SharePoint OAuth',
        'width=600,height=700,left=200,top=100'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      // Listen for message from popup
      const messageHandler = async (event) => {
        // Verify origin
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'OAUTH_CALLBACK') {
          window.removeEventListener('message', messageHandler);

          const { code, state: returnedState } = event.data;

          // Verify state matches
          if (returnedState !== state) {
            reject(new Error('Invalid state parameter'));
            return;
          }

          // Retrieve code verifier
          const storedVerifier = sessionStorage.getItem(`oauth_verifier_${returnedState}`);
          const storedSiteUrl = sessionStorage.getItem(`oauth_siteurl_${returnedState}`);

          // Clean up
          sessionStorage.removeItem(`oauth_verifier_${returnedState}`);
          sessionStorage.removeItem(`oauth_siteurl_${returnedState}`);

          if (!storedVerifier) {
            reject(new Error('Code verifier not found'));
            return;
          }

          try {
            // Exchange code for token (in browser!)
            const token = await exchangeCodeForToken(code, storedVerifier, storedSiteUrl, redirectUri);
            resolve(token);
          } catch (error) {
            reject(error);
          }
        } else if (event.data.type === 'OAUTH_ERROR') {
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.errorDescription || event.data.error));
        }
      };

      window.addEventListener('message', messageHandler);

      // Handle popup closed without completing auth
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', messageHandler);
          // Clean up
          sessionStorage.removeItem(`oauth_verifier_${state}`);
          sessionStorage.removeItem(`oauth_siteurl_${state}`);
          reject(new Error('Authentication cancelled'));
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Exchanges authorization code for access token
 * This happens in the browser (SPA flow)
 */
async function exchangeCodeForToken(code, codeVerifier, siteUrl, redirectUri) {
  const url = new URL(siteUrl);
  const resource = `https://${url.hostname}`;

  const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    scope: `${resource}/.default offline_access`,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Token exchange failed');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresOn: new Date(Date.now() + data.expires_in * 1000),
  };
}
