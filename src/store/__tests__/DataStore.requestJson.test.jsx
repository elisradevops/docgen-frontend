import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({
  toast: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const createStorageMock = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

const mockWindow = {
  APP_CONFIG: { JSON_DOCUMENT_URL: 'http://localhost:30001' },
  location: { search: '' },
  dispatchEvent: () => {},
  sessionStorage: createStorageMock(),
  localStorage: createStorageMock(),
};

const mockDocument = {
  cookie: '',
  getElementsByTagName: () => [],
};

const setBaseState = (store) => {
  store.docType = 'SVD';
  store.contextName = 'ctx';
  store.teamProjectName = 'TP';
  store.selectedTemplate = { text: 'templates/svd.dotx', url: '/templates/svd.dotx' };
  store.isCustomTemplate = false;
  store.userDetails = { name: 'tester' };
  store.ProjectBucketName = 'bucket';
  store.formattingSettings = {};
  store.releaseDefinitionList = [];
};

describe('DataStore requestJson content control passthrough', () => {
  let store;

  beforeEach(async () => {
    globalThis.window = mockWindow;
    globalThis.document = mockDocument;
    globalThis.CustomEvent = class CustomEvent {
      constructor(name) {
        this.type = name;
      }
    };

    vi.resetModules();
    store = (await import('../DataStore.jsx')).default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not inject release-file-content-control for SVD release range', () => {
    setBaseState(store);
    store.contentControls = [
      {
        type: 'change-description-table',
        title: 'change-description-table',
        data: {
          rangeType: 'release',
          selectedRelease: { key: '17', text: '17 - test-release' },
          toText: 'Release-17',
        },
      },
    ];

    const request = store.requestJson;
    const releaseControls = request.contentControls.filter((c) => c.title === 'release-file-content-control');

    expect(releaseControls).toHaveLength(0);
    expect(request.contentControls).toHaveLength(1);
  });

  it('keeps contentControls unchanged when release-file-content-control already exists', () => {
    setBaseState(store);
    store.contentControls = [
      {
        type: 'change-description-table',
        title: 'change-description-table',
        data: {
          rangeType: 'pipeline',
        },
      },
      {
        type: 'release-file-content-control',
        title: 'release-file-content-control',
        data: {
          releaseFileName: 'from-ui.zip',
        },
      },
    ];

    const request = store.requestJson;
    const releaseControls = request.contentControls.filter((c) => c.title === 'release-file-content-control');

    expect(releaseControls).toHaveLength(1);
    expect(releaseControls[0].data.releaseFileName).toBe('from-ui.zip');
  });
});
