let sdkPromise;
let initPromise;

const shouldDebugLogs = () => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('debug');
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
};

const getRequireJs = () => {
  if (typeof window === 'undefined') return null;
  return window.requirejs || window.require || null;
};

const configureRequireJs = () => {
  const req = getRequireJs();
  if (!req) return null;
  try {
    const baseUrl = new URL('.', window.location.href).toString();
    req.config({
      baseUrl,
      paths: {
        VSS: 'lib',
        XDM: 'lib/XDM',
        tslib: 'lib/tslib',
      },
    });
  } catch {
    /* ignore config errors */
  }
  return req;
};

export const loadAdoSdk = async () => {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    const req = configureRequireJs();
    if (!req) {
      resolve(null);
      return;
    }
    req(['VSS/SDK'], (SDK) => resolve(SDK || null), () => resolve(null));
  });
  return sdkPromise;
};

export const initAdoContext = async () => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const SDK = await loadAdoSdk();
    if (!SDK || typeof SDK.init !== 'function') {
      return { isAdo: false };
    }

    SDK.init({ loaded: false, applyTheme: true });
    let ready = true;
    if (typeof SDK.ready === 'function') {
      ready = await Promise.race([
        SDK.ready().then(() => true).catch(() => false),
        new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
      ]);
    }
    if (!ready) {
      return { isAdo: false };
    }

    const hostInfo = typeof SDK.getHost === 'function' ? SDK.getHost() : null;
    const webContext =
      (typeof SDK.getWebContext === 'function' && SDK.getWebContext()) ||
      hostInfo?.webContext ||
      null;

    let project = webContext?.project || null;
    try {
      if ((!project || !project.id) && typeof SDK.getPageContext === 'function') {
        const pageContext = SDK.getPageContext();
        if (pageContext?.project?.id) {
          project = { ...project, ...pageContext.project };
        }
      }
    } catch {
      /* empty */
    }
    if (shouldDebugLogs()) {
      console.debug('[ado] sdk context', {
        webProject: webContext?.project,
        pageProject: typeof SDK.getPageContext === 'function' ? SDK.getPageContext()?.project : null,
        project,
        hostInfo,
      });
    }
    let collectionUri =
      webContext?.collection?.uri ||
      webContext?.collection?.url ||
      hostInfo?.host?.uri ||
      hostInfo?.host?.url ||
      webContext?.account?.uri ||
      webContext?.host?.uri ||
      '';

    if (!collectionUri && typeof window !== 'undefined') {
      const rawBase = window.location.href.split('/_apps/')[0] || '';
      if (rawBase && !rawBase.includes('/_apis/public/gallery/')) {
        const parts = rawBase.split('/');
        if (project?.name && parts[parts.length - 1]?.toLowerCase() === project.name.toLowerCase()) {
          parts.pop();
        }
        collectionUri = `${parts.join('/')}/`;
      }
    }

    if (!collectionUri && typeof document !== 'undefined') {
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref) {
          let refBase = ref.origin + ref.pathname;
          if (refBase.includes('/_apps/')) {
            refBase = refBase.split('/_apps/')[0];
          }
          if (project?.name && refBase.toLowerCase().endsWith(`/${project.name.toLowerCase()}`)) {
            refBase = refBase.slice(0, -project.name.length - 1);
          }
          if (refBase && !refBase.includes('/_apis/public/gallery/')) {
            collectionUri = refBase.endsWith('/') ? refBase : `${refBase}/`;
          }
        }
      } catch {
        /* empty */
      }
    }

    const deriveNamesFromUrl = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return { collectionName: '', projectName: '' };
      try {
        const url = new URL(raw);
        const segments = url.pathname.split('/').filter(Boolean);
        const appsIndex = segments.indexOf('_apps');
        const collectionName = segments[0] || '';
        let projectName = '';
        if (appsIndex > 1) {
          projectName = segments[appsIndex - 1] || '';
        }
        return { collectionName, projectName };
      } catch {
        return { collectionName: '', projectName: '' };
      }
    };

    let collectionName = webContext?.collection?.name || '';
    if (!collectionName || !project?.name) {
      const fromLocation =
        typeof window !== 'undefined' ? deriveNamesFromUrl(window.location.href) : null;
      if (!collectionName) collectionName = fromLocation?.collectionName || '';
      if (!project?.name && fromLocation?.projectName) {
        project = { name: fromLocation.projectName };
      }
    }
    if ((!collectionName || !project?.name) && typeof document !== 'undefined') {
      const fromRef = deriveNamesFromUrl(document.referrer || '');
      if (!collectionName) collectionName = fromRef.collectionName || collectionName;
      if (!project?.name && fromRef.projectName) {
        project = { name: fromRef.projectName };
      }
    }

    const normalizeCollectionUri = (value, inputCollectionName, projectName) => {
      const raw = String(value || '').trim();
      if (!raw) return raw;
      let uri = raw.endsWith('/') ? raw : `${raw}/`;
      try {
        const url = new URL(uri);
        const segments = url.pathname.split('/').filter(Boolean);
        const normalizedCollection = inputCollectionName || collectionName;
        if (normalizedCollection) {
          const idx = segments.findIndex(
            (seg) => seg.toLowerCase() === normalizedCollection.toLowerCase()
          );
          if (idx !== -1 && idx < segments.length - 1) {
            url.pathname = `/${segments.slice(0, idx + 1).join('/')}/`;
            return url.toString();
          }
        }
        if (projectName && segments.length > 1) {
          const last = segments[segments.length - 1];
          if (last.toLowerCase() === projectName.toLowerCase()) {
            url.pathname = `/${segments.slice(0, -1).join('/')}/`;
            return url.toString();
          }
        }
        return url.toString();
      } catch {
        return uri;
      }
    };

    let accessToken = '';
    try {
      if (typeof SDK.getAccessToken === 'function') {
        accessToken = await SDK.getAccessToken();
      }
    } catch {
      /* ignore token errors */
    }

    return {
      isAdo: true,
      sdk: SDK,
      webContext,
      project,
      collectionUri: normalizeCollectionUri(
        collectionUri,
        collectionName,
        project?.name
      ),
      accessToken,
    };
  })();
  return initPromise;
};
