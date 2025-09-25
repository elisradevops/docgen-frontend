import React, { useEffect } from 'react';
import MainTabs from './components/tabs/MainTabs';
import SettingsPage from './components/settings/SettingPage';
import { Slide, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast.css';
import { useCookies } from 'react-cookie';
import {
  makeKey,
  tryLocalStorageSet,
  trySessionStorageGet,
  trySessionStorageSet,
  trySessionStorageRemove,
} from './utils/storage';

function App({ store }) {
  const [cookies, setCookie, removeCookie] = useCookies(['azureDevopsUrl', 'azureDevopsPat']);

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
      const msg =
        result.status === 401
          ? 'Invalid or expired PAT. Please create/copy a new PAT and try again.'
          : `Login failed${result.status ? ` (${result.status})` : ''}. ${result.message || ''}`;
      toast.error(msg);
      return; // Block login
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
        removeCookie('azureDevopsUrl', { path: '/' });
        removeCookie('azureDevopsPat', { path: '/' });
      } catch {
        /* empty */
      }
    };
    window.addEventListener('auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', onUnauthorized);
  }, [removeCookie]);

  // Keep the store's API client in sync with cookies (handles refresh/autofill cases)
  useEffect(() => {
    try {
      if (cookies.azureDevopsUrl && cookies.azureDevopsPat && typeof store?.setCredentials === 'function') {
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
      {cookies.azureDevopsUrl && cookies.azureDevopsPat ? (
        <MainTabs store={store} />
      ) : (
        <SettingsPage login={login.bind(this)} />
      )}
    </div>
  );
}

export default App;
