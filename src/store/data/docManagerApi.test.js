import { beforeEach, describe, expect, test, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxios = vi.fn();
  mockAxios.post = vi.fn();
  return { default: mockAxios };
});

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

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
