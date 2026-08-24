import { beforeEach, describe, expect, test, vi } from 'vitest';

// DataStore.jsx is a large singleton with many side-effecting imports; this
// file scopes coverage to the ADO access-token refresh guard
// (`ensureFreshAdoAccessToken`) only — it does not attempt full store
// coverage.

vi.mock('js-cookies', () => ({
  default: {
    getItem: vi.fn(() => ''),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../utils/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./data/docManagerApi', () => ({
  getBucketFileList: vi.fn(),
  getJSONContentFromFile: vi.fn(),
  sendDocumentToGenerator: vi.fn(),
  createIfBucketDoesNotExist: vi.fn(),
  uploadFileToStorage: vi.fn(),
  deleteFile: vi.fn(),
  validateMewpExternalFiles: vi.fn(),
  getFavoriteList: vi.fn(),
  deleteFavoriteFromDb: vi.fn(),
  createFavorite: vi.fn(),
}));

const restApiInstance = { getWindowsIdentity: vi.fn() };
vi.mock('./actions/AzureDevopsRestApi', () => ({
  default: vi.fn().mockImplementation(function RestApi() {
    return restApiInstance;
  }),
  setAuthErrorHandler: vi.fn(),
}));

const getAccessToken = vi.fn();
const mockSdk = { getAccessToken };
vi.mock('../adoSdk', () => ({
  loadAdoSdk: vi.fn(() => Promise.resolve(mockSdk)),
}));

describe('DataStore ensureFreshAdoAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAccessToken.mockReset();
    vi.stubGlobal('window', {
      APP_CONFIG: { JSON_DOCUMENT_URL: 'http://api-gate' },
      location: { search: '' },
      dispatchEvent: vi.fn(),
      sessionStorage: { length: 0, key: vi.fn(), removeItem: vi.fn() },
    });
  });

  test('no-ops outside ADO extension mode (no SDK call)', async () => {
    const { loadAdoSdk } = await import('../adoSdk');
    const store = (await import('./DataStore')).default;

    store.setAdoMode(false);
    store.setCredentials('https://org/', 'bearer:old-token');

    await store.ensureFreshAdoAccessToken();

    expect(loadAdoSdk).not.toHaveBeenCalled();
    expect(store.adoToken).toBe('bearer:old-token');
  });

  test('refreshes the token from the SDK when in ADO mode', async () => {
    getAccessToken.mockResolvedValueOnce('fresh-raw-token');
    const store = (await import('./DataStore')).default;

    store.setCredentials('https://org/', 'bearer:old-token');
    store.setAdoMode(true);

    await store.ensureFreshAdoAccessToken();

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(store.adoToken).toBe('bearer:fresh-raw-token');
  });

  test('fails open when the SDK refetch throws — keeps the existing token, logs a warning', async () => {
    getAccessToken.mockRejectedValueOnce(new Error('host frame gone'));
    const logger = (await import('../utils/logger')).default;
    const store = (await import('./DataStore')).default;

    store.setCredentials('https://org/', 'bearer:old-token');
    store.setAdoMode(true);

    await expect(store.ensureFreshAdoAccessToken()).resolves.toBeUndefined();

    expect(store.adoToken).toBe('bearer:old-token');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('host frame gone'));
  });

  test('dedupes concurrent calls — the SDK is only asked once', async () => {
    let resolveToken;
    getAccessToken.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToken = resolve;
      })
    );
    const { loadAdoSdk } = await import('../adoSdk');
    const store = (await import('./DataStore')).default;

    store.setCredentials('https://org/', 'bearer:old-token');
    store.setAdoMode(true);

    // Note: an `async function` always returns a fresh wrapper Promise, even
    // when it `return`s an existing one internally — so `first`/`second`
    // are never the same object by reference even when correctly deduped.
    // What actually proves dedup is the call-count assertions below.
    const first = store.ensureFreshAdoAccessToken();
    const second = store.ensureFreshAdoAccessToken();

    resolveToken('fresh-raw-token');
    await first;
    await second;

    expect(loadAdoSdk).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(store.adoToken).toBe('bearer:fresh-raw-token');
  });
});
