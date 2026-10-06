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

describe('DataStore sendRequestToDocGen (Phase 6b captureDiagnostics)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      APP_CONFIG: { JSON_DOCUMENT_URL: 'http://api-gate' },
      location: { search: '' },
      dispatchEvent: vi.fn(),
      sessionStorage: { length: 0, key: vi.fn(), removeItem: vi.fn() },
    });
  });

  test('includes captureDiagnostics in the request and resets it to false after sending', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    sendDocumentToGenerator.mockResolvedValue({ ok: true });
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const store = (await import('./DataStore')).default;
    store.ensureFreshAdoAccessToken = vi.fn().mockResolvedValue(undefined);
    store.setCaptureDiagnostics(true);

    await store.sendRequestToDocGen();

    expect(sendDocumentToGenerator).toHaveBeenCalledTimes(1);
    expect(sendDocumentToGenerator.mock.calls[0][0]).toMatchObject({ captureDiagnostics: true });
    expect(store.captureDiagnostics).toBe(false);
  });

  test('disarms captureDiagnostics when the document type changes, keeps it when unchanged', async () => {
    const store = (await import('./DataStore')).default;
    store.setDocType('STD');
    store.setCaptureDiagnostics(true);

    store.setDocType('STD');
    expect(store.captureDiagnostics).toBe(true);

    store.setDocType('STR');
    expect(store.captureDiagnostics).toBe(false);

    store.setDocType('STD');
    expect(store.captureDiagnostics).toBe(false);
  });

  test('resets captureDiagnostics to false even when the request fails', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    sendDocumentToGenerator.mockRejectedValue(new Error('server down'));
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const store = (await import('./DataStore')).default;
    store.ensureFreshAdoAccessToken = vi.fn().mockResolvedValue(undefined);
    store.setCaptureDiagnostics(true);

    await expect(store.sendRequestToDocGen()).rejects.toThrow('server down');

    expect(store.captureDiagnostics).toBe(false);
  });

  test('turning "Show debug doc types" off disarms diagnostics capture; turning it on does not arm it', async () => {
    const store = (await import('./DataStore')).default;
    store.setShowDebugDocs(true);
    expect(store.captureDiagnostics).toBe(false);
    store.setCaptureDiagnostics(true);
    store.setShowDebugDocs(true);
    expect(store.captureDiagnostics).toBe(true);
    store.setShowDebugDocs(false);
    expect(store.captureDiagnostics).toBe(false);
  });

  test('registers the request context and rotates the session id after each generation', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    sendDocumentToGenerator.mockResolvedValue({ ok: true });
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const { getPickerContextHeaders } = await import('../utils/requestContext');
    const store = (await import('./DataStore')).default;
    store.ensureFreshAdoAccessToken = vi.fn().mockResolvedValue(undefined);
    store.setDocumentTypeTitle('STD');
    store.teamProjectName = 'MEWP';

    const before = store.sessionId;
    expect(before).toMatch(/^ses-[0-9a-f-]{36}$/);
    expect(getPickerContextHeaders()).toEqual({
      'x-docgen-project': 'MEWP',
      'x-docgen-doc-type': 'STD',
      'x-docgen-run-id': before,
    });

    await store.sendRequestToDocGen();

    expect(store.sessionId).not.toBe(before);
    expect(store.sessionId).toMatch(/^ses-[0-9a-f-]{36}$/);
    expect(getPickerContextHeaders()['x-docgen-run-id']).toBe(store.sessionId);
  });

  test('Cancel during the token refresh stops the request before it is sent', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const store = (await import('./DataStore')).default;
    let finishRefresh = () => undefined;
    store.ensureFreshAdoAccessToken = vi.fn(() => new Promise((resolve) => { finishRefresh = resolve; }));

    const sending = store.sendRequestToDocGen();
    store.cancelGeneration();
    finishRefresh();

    await expect(sending).rejects.toMatchObject({ cancelled: true });
    expect(sendDocumentToGenerator).not.toHaveBeenCalled();
    expect(store.generationAbortController).toBeNull();
  });

  test('Cancel while the request is in flight aborts its signal and clears the controller', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    let signal;
    sendDocumentToGenerator.mockImplementation(
      (_doc, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { cancelled: true })));
        })
    );
    const store = (await import('./DataStore')).default;
    store.ensureFreshAdoAccessToken = vi.fn().mockResolvedValue(undefined);

    const sending = store.sendRequestToDocGen();
    await vi.waitFor(() => expect(signal).toBeDefined());
    store.cancelGeneration();

    await expect(sending).rejects.toMatchObject({ cancelled: true });
    expect(signal.aborted).toBe(true);
    expect(store.generationAbortController).toBeNull();
  });

  test('cancelGeneration with nothing running does nothing', async () => {
    const store = (await import('./DataStore')).default;
    expect(() => store.cancelGeneration()).not.toThrow();
  });

  test('rotates the session even when the generation request fails', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    sendDocumentToGenerator.mockRejectedValue(new Error('boom'));
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const store = (await import('./DataStore')).default;
    store.ensureFreshAdoAccessToken = vi.fn().mockResolvedValue(undefined);
    const before = store.sessionId;
    await expect(store.sendRequestToDocGen()).rejects.toThrow('boom');
    expect(store.sessionId).not.toBe(before);
  });

  test('defaults captureDiagnostics to false when never toggled on', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    sendDocumentToGenerator.mockResolvedValue({ ok: true });
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const store = (await import('./DataStore')).default;
    store.ensureFreshAdoAccessToken = vi.fn().mockResolvedValue(undefined);

    await store.sendRequestToDocGen();

    expect(sendDocumentToGenerator.mock.calls[0][0]).toMatchObject({ captureDiagnostics: false });
  });
});

describe('DataStore generateHistoricalCompareReport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      APP_CONFIG: { JSON_DOCUMENT_URL: 'http://api-gate' },
      location: { search: '' },
      dispatchEvent: vi.fn(),
      sessionStorage: { length: 0, key: vi.fn(), removeItem: vi.fn() },
    });
  });

  test('sends only queryId + as-of timestamps, not the full compareResult rows/diffs', async () => {
    const { sendDocumentToGenerator, createIfBucketDoesNotExist } = await import('./data/docManagerApi');
    sendDocumentToGenerator.mockResolvedValue({ ok: true });
    createIfBucketDoesNotExist.mockResolvedValue(undefined);
    const store = (await import('./DataStore')).default;

    store.setAdoMode(false);
    store.setCredentials('https://dev.azure.com/org/', 'bearer:token');
    // Set the project fields directly rather than via setTeamProject(), which side-effects into
    // a full bootstrapProjectData() cascade (fetchTestPlans, fetchDocuments, ...) that is
    // irrelevant to — and unmocked for — this test.
    store.teamProject = 'proj-id';
    store.teamProjectName = 'MEWP';
    store.ProjectBucketName = 'mewp';
    store.setHistoricalCompareResult({
      queryId: 'q-1',
      queryName: 'Shared Query',
      baseline: { asOf: '2025-12-22T17:08:00.000Z', total: 4 },
      compareTo: { asOf: '2025-12-28T08:57:00.000Z', total: 4 },
      summary: { updatedCount: 1 },
      rows: [
        {
          id: 11,
          compareStatus: 'Changed',
          differences: [{ field: 'Description', baseline: '<p>old</p>', compareTo: '<p>new</p>' }],
        },
      ],
    });

    await store.generateHistoricalCompareReport();

    expect(sendDocumentToGenerator).toHaveBeenCalledTimes(1);
    const requestPayload = sendDocumentToGenerator.mock.calls[0][0];
    const contentControl = requestPayload.contentControls[0];
    expect(contentControl.data).toEqual({
      teamProjectName: 'MEWP',
      queryName: 'Shared Query',
      queryId: 'q-1',
      baselineAsOf: '2025-12-22T17:08:00.000Z',
      compareToAsOf: '2025-12-28T08:57:00.000Z',
    });
    // The heavy part of the compare result (rows/differences/HTML) must not be in the request —
    // content-control re-fetches it server-side from queryId + the two timestamps.
    expect(contentControl.data.rows).toBeUndefined();
    expect(contentControl.data.compareResult).toBeUndefined();
    expect(JSON.stringify(requestPayload.contentControls)).not.toContain('Description');
  });

  test('throws when there is no historical compare result to report on', async () => {
    const store = (await import('./DataStore')).default;
    store.setHistoricalCompareResult(null);

    await expect(store.generateHistoricalCompareReport()).rejects.toThrow(
      'Missing historical compare result'
    );
  });
});
