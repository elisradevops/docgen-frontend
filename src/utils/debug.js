const state = {
  lastApiError: null,
};

export const setLastApiError = (error) => {
  const payload = {
    ...error,
    time: error?.time || new Date().toISOString(),
  };
  state.lastApiError = payload;
  if (typeof window === 'undefined') return;
  try {
    window.__docgenLastApiError = payload;
  } catch {
    /* empty */
  }
  try {
    window.dispatchEvent(new CustomEvent('docgen:debug-error', { detail: payload }));
  } catch {
    /* empty */
  }
};

export const getLastApiError = () => {
  if (typeof window === 'undefined') return state.lastApiError;
  try {
    return window.__docgenLastApiError || null;
  } catch {
    return state.lastApiError;
  }
};
