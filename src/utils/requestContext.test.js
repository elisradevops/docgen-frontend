import { afterEach, describe, expect, test } from 'vitest';
import { getPickerContextHeaders, getSessionHeader, setRequestContextProvider } from './requestContext';

afterEach(() => setRequestContextProvider(null));

describe('getPickerContextHeaders', () => {
  test('is empty until a provider is registered', () => {
    expect(getPickerContextHeaders()).toEqual({});
    expect(getSessionHeader()).toEqual({});
  });

  test('carries project, doc type and the session as the run id', () => {
    setRequestContextProvider(() => ({ project: 'MEWP', docType: 'STD', sessionId: 'ses-abc_123' }));
    expect(getPickerContextHeaders()).toEqual({
      'x-docgen-project': 'MEWP',
      'x-docgen-doc-type': 'STD',
      'x-docgen-run-id': 'ses-abc_123',
    });
  });

  test('percent-encodes non-ASCII project names so the header stays valid', () => {
    setRequestContextProvider(() => ({ project: 'פרויקט A/B', docType: 'STD' }));
    const value = getPickerContextHeaders()['x-docgen-project'];
    expect(value).toMatch(/^[\x20-\x7e]+$/);
    expect(decodeURIComponent(value)).toBe('פרויקט A/B');
  });

  test('omits what is empty and ignores a session id that is not a ses- id', () => {
    setRequestContextProvider(() => ({ project: '', docType: '  ', sessionId: 'run-1' }));
    expect(getPickerContextHeaders()).toEqual({});
    expect(getSessionHeader()).toEqual({});
  });

  test('bounds an oversized project name', () => {
    setRequestContextProvider(() => ({ project: 'x'.repeat(500) }));
    expect(decodeURIComponent(getPickerContextHeaders()['x-docgen-project'])).toHaveLength(128);
  });

  test('a throwing provider never breaks a call', () => {
    setRequestContextProvider(() => {
      throw new Error('boom');
    });
    expect(getPickerContextHeaders()).toEqual({});
  });
});

describe('getSessionHeader', () => {
  test('is the session id under x-docgen-session-id', () => {
    setRequestContextProvider(() => ({ sessionId: 'ses-9d2f' }));
    expect(getSessionHeader()).toEqual({ 'x-docgen-session-id': 'ses-9d2f' });
  });
});
