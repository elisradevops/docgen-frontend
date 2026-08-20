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
