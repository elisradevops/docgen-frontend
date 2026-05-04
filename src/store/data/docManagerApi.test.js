import { beforeEach, describe, expect, test, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

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
