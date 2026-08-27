import { beforeEach, describe, expect, test, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  // `axios` is called both as a function (makeRequest's `axios(url, config)`)
  // and via `.post` (sendDocumentToGenerator etc.) — the mock needs to support both.
  const mockAxios = vi.fn();
  mockAxios.post = vi.fn();
  return { default: mockAxios };
});

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'doc-id-1'),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../../utils/debug', () => ({
  setLastApiError: vi.fn(),
}));

vi.mock('../../utils/requestQueue', () => ({
  enqueueRequest: vi.fn((fn) => fn()),
}));

vi.mock('../../utils/authTransport', () => ({
  authRequestConfig: vi.fn(),
}));

describe('docManagerApi sendDocumentToGenerator', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      APP_CONFIG: {
        JSON_DOCUMENT_URL: 'http://api-gate',
      },
    });
  });

  test('uses response message instead of object error for generator failures', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Failed to create the document Could not load source release #14',
          error: {
            message: 'Could not load source release #14',
            code: 'SVD_RANGE_RESOLUTION_FAILED',
          },
        },
      },
    });

    const { sendDocumentToGenerator } = await import('./docManagerApi.jsx');

    await expect(sendDocumentToGenerator({})).rejects.toThrow(
      'Failed to create the document Could not load source release #14'
    );
  });

  test('extracts nested object error message when response message is missing', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Release history failed',
            code: 'SVD_RELEASE_HISTORY_FAILED',
          },
        },
      },
    });

    const { sendDocumentToGenerator } = await import('./docManagerApi.jsx');

    await expect(sendDocumentToGenerator({})).rejects.toThrow('Release history failed');
  });
});

describe('docManagerApi resolveSharePointUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      APP_CONFIG: {
        JSON_DOCUMENT_URL: 'http://api-gate',
      },
    });
  });

  test('posts the pasted URL and credentials, returning the resolved config', async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: true, siteUrl: 'http://sp-server/sites/project', library: '', folder: 'Templates' },
    });

    const { resolveSharePointUrl } = await import('./docManagerApi.jsx');
    const credentials = { username: 'user', password: 'pass' };

    const result = await resolveSharePointUrl('http://sp-server/sites/project/Templates', credentials);

    expect(axios.post).toHaveBeenCalledWith(
      'http://api-gate/sharepoint/resolve-url',
      { url: 'http://sp-server/sites/project/Templates', credentials },
      expect.anything()
    );
    expect(result).toEqual({
      success: true,
      siteUrl: 'http://sp-server/sites/project',
      library: '',
      folder: 'Templates',
    });
  });

  test('throws the backend message on failure', async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { message: 'Could not resolve a SharePoint site from this URL' } },
    });

    const { resolveSharePointUrl } = await import('./docManagerApi.jsx');

    await expect(resolveSharePointUrl('http://bad-url', { username: 'u', password: 'p' })).rejects.toThrow(
      'Could not resolve a SharePoint site from this URL'
    );
  });
});

describe('docManagerApi SharePoint session auth (no client-supplied Graph token)', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', { APP_CONFIG: { JSON_DOCUMENT_URL: 'http://api-gate' } });
    const { authRequestConfig } = await import('../../utils/authTransport');
    authRequestConfig.mockReturnValue({ withCredentials: true, headers: { 'X-Csrf-Token': 'csrf-1' } });
  });

  test('testSharePointConnection: an Online call (no auth argument) never sends oauthToken, and carries the session config', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const { testSharePointConnection } = await import('./docManagerApi.jsx');

    await testSharePointConnection('https://tenant.sharepoint.com/:f:/r/x', '', '');

    const [, body, config] = axios.post.mock.calls[0];
    expect(body).not.toHaveProperty('oauthToken');
    expect(body).not.toHaveProperty('credentials');
    expect(config.withCredentials).toBe(true);
    expect(config.headers['X-Csrf-Token']).toBe('csrf-1');
  });

  test('testSharePointConnection: an on-prem call still sends credentials, never oauthToken', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const { testSharePointConnection } = await import('./docManagerApi.jsx');
    const credentials = { username: 'u', password: 'p' };

    await testSharePointConnection('http://sp-server/sites/x', 'lib', 'folder', credentials);

    const [, body] = axios.post.mock.calls[0];
    expect(body.credentials).toEqual(credentials);
    expect(body).not.toHaveProperty('oauthToken');
  });

  test('listSharePointFiles: no oauthToken in the body regardless of auth presence', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true, files: [] } });
    const { listSharePointFiles } = await import('./docManagerApi.jsx');

    await listSharePointFiles('https://tenant.sharepoint.com/:f:/r/x', '', '');

    const [, body] = axios.post.mock.calls[0];
    expect(body).not.toHaveProperty('oauthToken');
  });

  test('checkSharePointConflicts: no oauthToken in the body, session config still applied', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true, conflicts: [], newFiles: [] } });
    const { checkSharePointConflicts } = await import('./docManagerApi.jsx');

    await checkSharePointConflicts({
      siteUrl: 'https://tenant.sharepoint.com/:f:/r/x',
      library: '',
      folder: '',
      bucketName: 'templates',
      projectName: 'proj',
    });

    const [, body, config] = axios.post.mock.calls[0];
    expect(body).not.toHaveProperty('oauthToken');
    expect(config.withCredentials).toBe(true);
  });

  test('syncSharePointTemplates: no oauthToken in the body, session config still applied', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true, syncedFiles: [] } });
    const { syncSharePointTemplates } = await import('./docManagerApi.jsx');

    await syncSharePointTemplates({
      siteUrl: 'https://tenant.sharepoint.com/:f:/r/x',
      library: '',
      folder: '',
      bucketName: 'templates',
      projectName: 'proj',
    });

    const [, body, config] = axios.post.mock.calls[0];
    expect(body).not.toHaveProperty('oauthToken');
    expect(config.withCredentials).toBe(true);
  });

  test('a 401 reauth_required failure preserves .status/.code on the thrown Error (backend sends no .message for this shape)', async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 401, data: { success: false, error: 'reauth_required' } },
      message: 'Request failed with status code 401',
    });
    const { checkSharePointConflicts } = await import('./docManagerApi.jsx');

    let caught;
    try {
      await checkSharePointConflicts({
        siteUrl: 'https://tenant.sharepoint.com/:f:/r/x',
        library: '',
        folder: '',
        bucketName: 'templates',
        projectName: 'proj',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught.status).toBe(401);
    expect(caught.code).toBe('reauth_required');
  });

  test('bearer mode: the Authorization header from authRequestConfig() is merged in without dropping baseHeaders', async () => {
    const { authRequestConfig } = await import('../../utils/authTransport');
    authRequestConfig.mockReturnValue({ headers: { Authorization: 'Bearer the-handle' } });
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const { testSharePointConnection } = await import('./docManagerApi.jsx');

    await testSharePointConnection('https://tenant.sharepoint.com/:f:/r/x', '', '');

    const [, , config] = axios.post.mock.calls[0];
    expect(config.headers.Authorization).toBe('Bearer the-handle');
    expect(config.headers['Content-Type']).toBe('application/json');
  });
});
