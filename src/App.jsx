import React, { useEffect, useState } from 'react';
import MainTabs from './components/tabs/MainTabs';
import SettingsPage from './components/settings/SettingPage';
import { Slide, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast.css';
import { useCookies } from 'react-cookie';
import { initAdoContext } from './adoSdk';
import DebugPanel from './components/common/DebugPanel';
import {
  makeKey,
  tryLocalStorageSet,
  trySessionStorageGet,
  trySessionStorageSet,
  trySessionStorageRemove,
} from './utils/storage';

const shouldLogDebug = () => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('debug');
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
};

const normalizeAdoOrgUrl = (value, collectionName, projectName) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withSlash = raw.endsWith('/') ? raw : `${raw}/`;
  try {
    const url = new URL(withSlash);
    const segments = url.pathname.split('/').filter(Boolean);
    if (collectionName) {
      const idx = segments.findIndex(
        (seg) => seg.toLowerCase() === String(collectionName).toLowerCase()
      );
      if (idx !== -1) {
        url.pathname = `/${segments.slice(0, idx + 1).join('/')}/`;
        return url.toString();
      }
    }
    if (projectName) {
      const last = segments[segments.length - 1] || '';
      if (last.toLowerCase() === String(projectName).toLowerCase()) {
        url.pathname = `/${segments.slice(0, -1).join('/')}/`;
        return url.toString();
      }
    }
    if (segments.length > 1) {
      url.pathname = `/${segments.slice(0, -1).join('/')}/`;
      return url.toString();
    }
  } catch {
    /* empty */
  }
  return withSlash;
};

function App({ store }) {
  const [cookies, setCookie, removeCookie] = useCookies(['azureDevopsUrl', 'azureDevopsPat']);
  const [adoContext, setAdoContext] = useState({ isAdo: false });
  const [adoReady, setAdoReady] = useState(false);
  const isAdoMode = !!adoContext?.isAdo;

  const login = async (selectedUrl, selectedPat) => {
    // Validate credentials first
    const normalizeUrl = (u) => {
      if (!u) return '';
      const hasProtocol = /^https?:\/\//i.test(u);
      return (hasProtocol ? u : `https://${u}`).replace(/\/+$/, '');
    };
    const normalizedInputUrl = normalizeUrl(selectedUrl);
    const result = await store.testCredentials(normalizedInputUrl, selectedPat);
    if (!result.ok) {
      // Throw error so SettingPage can catch and display it
      const error = new Error(result.message || 'Authentication failed');
      error.status = result.status;
      throw error;
    }

    // Persist cookies only after validation succeeds
    let d = new Date();
    d.setTime(d.getTime() + 525960 * 60 * 1000);
    const normalizedUrl = `${normalizedInputUrl}/`;
    setCookie('azureDevopsUrl', normalizedUrl, { path: '/', expires: d });
    setCookie('azureDevopsPat', selectedPat, { path: '/', expires: d });
    try {
      // Primary: namespaced per organization
      tryLocalStorageSet(makeKey('lastOrgUrl'), normalizedInputUrl);
      // Legacy/global for pre-login prefill compatibility
      window.localStorage.setItem('lastOrgUrl', normalizedInputUrl);
    } catch {
      /* empty */
    }
    // Update the in-memory API client to use the fresh credentials (no full reload)
    try {
      if (typeof store?.setCredentials === 'function') {
        store.setCredentials(normalizedUrl, selectedPat);
      }
    } catch {
      /* empty */
    }
    // Persist a post-login flag so we can show the welcome toast AFTER the reload
    try {
      trySessionStorageSet(
        makeKey('postLoginWelcome'),
        JSON.stringify({ name: result.name, ts: Date.now() })
      );
    } catch {
      /* empty */
    }
    // Reload the page to ensure all modules pick up fresh cookies/environment
    window.location.reload();
  };

  // Ensure top-level redirect to Login on global unauthorized
  useEffect(() => {
    const onUnauthorized = () => {
      try {
        if (store && typeof store.clearAllTabSessionState === 'function') {
          store.clearAllTabSessionState();
        }
      } catch {
        /* empty */
      }
      try {
        removeCookie('azureDevopsUrl', { path: '/' });
        removeCookie('azureDevopsPat', { path: '/' });
      } catch {
        /* empty */
      }
    };
    window.addEventListener('auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', onUnauthorized);
  }, [removeCookie, store]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const context = await initAdoContext();
      if (!mounted) return;
      if (shouldLogDebug()) {
        console.debug('[ado] initAdoContext', {
          isAdo: !!context?.isAdo,
          collectionUri: context?.collectionUri,
          project: context?.project?.name || null,
          collectionName: context?.webContext?.collection?.name || null,
        });
      }
      setAdoContext(context);
      if (context?.isAdo && context.collectionUri && context.accessToken) {
        try {
          const rawToken = String(context.accessToken || '').trim();
          const bearerToken = rawToken
            ? /^bearer[:\s]/i.test(rawToken)
              ? rawToken
              : `bearer:${rawToken}`
            : '';
          store.setAdoMode(true);
          const normalizedOrgUrl = normalizeAdoOrgUrl(
            context.collectionUri,
            context.webContext?.collection?.name,
            context.project?.name
          );
          if (shouldLogDebug()) {
            console.debug('[ado] setCredentials', {
              collectionUri: context.collectionUri,
              normalizedOrgUrl,
              project: context.project?.name || null,
              collectionName: context.webContext?.collection?.name || null,
              tokenLength: bearerToken.length,
            });
          }
          store.setCredentials(normalizedOrgUrl, bearerToken);
        } catch {
          /* empty */
        }
      } else {
        try {
          store.setAdoMode(false);
        } catch {
          /* empty */
        }
      }
      setAdoReady(true);
      try {
        if (context?.isAdo && typeof context?.sdk?.notifyLoadSucceeded === 'function') {
          context.sdk.notifyLoadSucceeded();
        }
      } catch {
        /* empty */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [store]);

  // Load document form metadata for standalone mode as early as possible.
  useEffect(() => {
    if (!isAdoMode) {
      store.fetchDocFolders();
    }
  }, [isAdoMode, store]);

  // Keep the store's API client in sync with cookies (handles refresh/autofill cases)
  useEffect(() => {
    try {
      if (
        !isAdoMode &&
        cookies.azureDevopsUrl &&
        cookies.azureDevopsPat &&
        typeof store?.setCredentials === 'function'
      ) {
        store.setCredentials(cookies.azureDevopsUrl, cookies.azureDevopsPat);
      }
    } catch {
      /* empty */
    }
  }, [cookies.azureDevopsUrl, cookies.azureDevopsPat, store]);

  // Show welcome toast after a successful login + reload
  useEffect(() => {
    try {
      const raw = trySessionStorageGet(makeKey('postLoginWelcome'));
      if (raw) {
        trySessionStorageRemove(makeKey('postLoginWelcome'));
        const data = JSON.parse(raw);
        if (data?.name) {
          toast.success(`Welcome ${data.name}!`);
        }
      }
    } catch {
      /* empty */
    }
  }, []);

  return (
    <div className='App'>
      <ToastContainer
        position='top-center'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        draggable
        pauseOnHover
        transition={Slide}
      />
      {!adoReady ? (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Loading Azure DevOps context...
        </div>
      ) : isAdoMode ? (
        <MainTabs
          store={store}
          adoContext={adoContext}
        />
      ) : cookies.azureDevopsUrl && cookies.azureDevopsPat ? (
        <MainTabs
          store={store}
          adoContext={adoContext}
        />
      ) : (
        <SettingsPage login={login.bind(this)} />
      )}
      <DebugPanel
        store={store}
        adoContext={adoContext}
      />
    </div>
  );
}

export default App;
