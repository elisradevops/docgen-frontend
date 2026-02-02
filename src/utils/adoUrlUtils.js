export const normalizeAdoOrgUrl = (value, collectionName, projectName) => {
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
  } catch {
    /* empty */
  }
  return withSlash;
};

export const deriveNamesFromUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { collectionName: '', projectName: '' };
  try {
    const url = new URL(raw);
    const segments = url.pathname.split('/').filter(Boolean);
    const appsIndex = segments.indexOf('_apps');
    const hasTfsRoot = (segments[0] || '').toLowerCase() === 'tfs';
    const collectionIndex = hasTfsRoot ? 1 : 0;
    const collectionName = segments[collectionIndex] || '';
    let projectName = '';
    if (appsIndex > collectionIndex + 1) {
      projectName = segments[appsIndex - 1] || '';
    } else if (!appsIndex && segments[collectionIndex + 1]) {
      projectName = segments[collectionIndex + 1] || '';
    }
    return { collectionName, projectName };
  } catch {
    return { collectionName: '', projectName: '' };
  }
};

export const normalizeCollectionUri = (value, collectionName, projectName) => {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const withSlash = raw.endsWith('/') ? raw : `${raw}/`;
  try {
    const url = new URL(withSlash);
    const segments = url.pathname.split('/').filter(Boolean);
    const normalizedCollection = collectionName || '';
    if (normalizedCollection) {
      const idx = segments.findIndex(
        (seg) => seg.toLowerCase() === normalizedCollection.toLowerCase()
      );
      if (idx !== -1 && idx < segments.length - 1) {
        url.pathname = `/${segments.slice(0, idx + 1).join('/')}/`;
        return url.toString();
      }
      if (idx === -1) {
        if (segments.length === 0) {
          url.pathname = `/${normalizedCollection}/`;
          return url.toString();
        }
        if (segments.length === 1 && segments[0].toLowerCase() === 'tfs') {
          url.pathname = `/tfs/${normalizedCollection}/`;
          return url.toString();
        }
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
    return withSlash;
  }
};
