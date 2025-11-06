import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useTabStatePersistence
 * Centralized hook to manage per-tab session restore/save gating and clear behavior.
 *
 * Responsibilities:
 * - Restore from selected favorite (when present) or from sessionStorage (when available).
 * - Gate downstream save effects using `isRestoring` and `restoreReady`.
 * - Provide `onClearTabState` to clear only the current tab's state for the given content control index.
 * - Listen for a docType-scoped clear event to reset all content controls in the active tab.
 *
 * Notes:
 * - To avoid infinite loops, the incoming `applySavedData` is stabilized via ref; effects do not depend on it directly.
 * - A de-dup key prevents re-applying an unchanged favorite. The key is reset on manual clear to allow reloading the same favorite.
 *
 * @param {Object} params
 * @param {import('../store/DataStore').default} params.store MobX store instance
 * @param {number} params.contentControlIndex Index of the content control (used for session key scoping)
 * @param {(data: any) => (void|Promise<void>)} params.applySavedData Callback to apply the restored data shape into the component state
 * @param {() => void} params.resetLocalState Callback to reset local component state when clearing
 * @returns {{ isRestoring: boolean, restoreReady: boolean, onClearTabState: () => void }}
 */
export default function useTabStatePersistence({
  store,
  contentControlIndex,
  applySavedData,
  resetLocalState,
}) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreReady, setRestoreReady] = useState(false);
  const restoredFromSessionRef = useRef(false);
  const savedDataRef = useRef(null);
  const appliedFavoriteKeyRef = useRef(null);

  // Keep latest applySavedData in a ref to avoid effect dependency loops
  const applySavedDataRef = useRef(applySavedData);
  useEffect(() => {
    applySavedDataRef.current = applySavedData;
  }, [applySavedData]);

  useEffect(() => {
    const fav = store?.selectedFavorite?.dataToSave;
    if (!fav) return;
    const favId = store?.selectedFavorite?.id;
    const key = favId != null ? `id:${favId}` : `hash:${(() => { try { return JSON.stringify(fav);} catch { return 'x'; } })()}`;
    if (appliedFavoriteKeyRef.current === key) return;
    (async () => {
      try {
        setIsRestoring(true);
        savedDataRef.current = fav || null;
        if (typeof applySavedDataRef.current === 'function') {
          await applySavedDataRef.current(fav);
        }
      } finally {
        setIsRestoring(false);
        setRestoreReady(true);
        appliedFavoriteKeyRef.current = key;
      }
    })();
  }, [store?.selectedFavorite]);

  useEffect(() => {
    if (restoredFromSessionRef.current) return;
    if (store?.selectedFavorite?.dataToSave) return;
    if (!store?.docType || !store?.teamProject) return;
    try {
      const dataToSave = store.loadTabSessionState(store.docType, contentControlIndex);
      if (!dataToSave) {
        setRestoreReady(true);
        return;
      }
      restoredFromSessionRef.current = true;
      (async () => {
        try {
          setIsRestoring(true);
          savedDataRef.current = dataToSave || null;
          if (typeof applySavedDataRef.current === 'function') {
            await applySavedDataRef.current(dataToSave);
          }
        } finally {
          setIsRestoring(false);
          setRestoreReady(true);
        }
      })();
    } catch {
      setRestoreReady(true);
    }
  }, [store, store?.docType, store?.teamProject, contentControlIndex, store?.selectedFavorite?.dataToSave]);

  const onClearTabState = useCallback(() => {
    try {
      if (store?.docType) {
        store.clearTabSessionState(store.docType, contentControlIndex);
      }
    } catch {
      /* empty */
    }
    if (typeof resetLocalState === 'function') {
      resetLocalState();
    }
    savedDataRef.current = null;
    // Allow re-applying the same favorite after a manual clear
    try {
      appliedFavoriteKeyRef.current = null;
    } catch {
      /* empty */
    }
  }, [store, contentControlIndex, resetLocalState]);

  useEffect(() => {
    const dt = store?.docType;
    if (!dt) return;
    const ev = `docgen:clear-tab:${dt}`;
    const handler = () => {
      onClearTabState();
    };
    try {
      window.addEventListener(ev, handler);
    } catch {
      /* empty */
    }
    return () => {
      try {
        window.removeEventListener(ev, handler);
      } catch {
        /* empty */
      }
    };
  }, [store?.docType, onClearTabState]);

  return { isRestoring, restoreReady, onClearTabState };
}
