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

  // Regression: a bare "code 401" toast with no indication of which downstream
  // dependency (MinIO, Azure DevOps, ...) actually rejected the request. Once
  // the backend labels the failure, the frontend must name it instead of just
  // echoing the message.
  test('names the failing dependency and url when the backend reports them', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Failed to fetch templates/proj/STD/file.dotx from MinIO: AccessDenied',
          code: 'AccessDenied',
          dependency: 'minio',
          url: 'http://dg-api-gate:3000/minio/download/templates/proj/STD/file.dotx',
        },
      },
    });

    const { sendDocumentToGenerator } = await import('./docManagerApi.jsx');

    await expect(sendDocumentToGenerator({})).rejects.toThrow(
      'Failed to fetch templates/proj/STD/file.dotx from MinIO: AccessDenied [minio] — http://dg-api-gate:3000/minio/download/templates/proj/STD/file.dotx'
    );
  });

  test('labels the dependency even without a message, using the error code', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: { code: 'AccessDenied', dependency: 'minio' },
      },
    });

    const { sendDocumentToGenerator } = await import('./docManagerApi.jsx');

    await expect(sendDocumentToGenerator({})).rejects.toThrow('request failed (AccessDenied) [minio]');
  });
});

describe('docManagerApi getBucketFileList', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      APP_CONFIG: {
        JSON_DOCUMENT_URL: 'http://api-gate',
      },
    });
  });

  // A team-project name containing "&" would otherwise split the query string
  // mid-value and truncate everything after it.
  test('percent-encodes projectName in the query string', async () => {
    axios.mockResolvedValueOnce({ data: { bucketFileList: [] } });

    const { getBucketFileList } = await import('./docManagerApi.jsx');
    await getBucketFileList('templates', 'STD', false, 'my project & co');

    expect(axios).toHaveBeenCalledWith(
      'http://api-gate/minio/bucketFileList/templates?docType=STD&isExternalUrl=false&recurse=false&projectName=my%20project%20%26%20co',
      expect.any(Object)
    );
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
