import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../adoSdk', () => ({
  isAdoEmbedded: vi.fn(),
}));

import { isAdoEmbedded } from '../adoSdk';
import {
  getTransportMode,
  setBearerHandle,
  clearBearerHandle,
  hasBearerHandle,
  authRequestConfig,
} from './authTransport';

describe('authTransport', () => {
  beforeEach(() => {
    clearBearerHandle();
    vi.stubGlobal('document', { cookie: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('getTransportMode', () => {
    it('returns "bearer" when embedded in the ADO iframe', () => {
      isAdoEmbedded.mockReturnValue(true);
      expect(getTransportMode()).toBe('bearer');
    });

    it('returns "cookie" for the standalone top-level app', () => {
      isAdoEmbedded.mockReturnValue(false);
      expect(getTransportMode()).toBe('cookie');
    });
  });

  describe('bearer handle storage', () => {
    it('starts with no handle', () => {
      expect(hasBearerHandle()).toBe(false);
    });

    it('stores and reports a handle once set', () => {
      setBearerHandle('the-handle');
      expect(hasBearerHandle()).toBe(true);
    });

    it('clears the handle', () => {
      setBearerHandle('the-handle');
      clearBearerHandle();
      expect(hasBearerHandle()).toBe(false);
    });

    it('never writes the handle to localStorage or sessionStorage', () => {
      const localSetItem = vi.fn();
      const sessionSetItem = vi.fn();
      vi.stubGlobal('localStorage', { setItem: localSetItem });
      vi.stubGlobal('sessionStorage', { setItem: sessionSetItem });

      setBearerHandle('the-handle');

      expect(localSetItem).not.toHaveBeenCalled();
      expect(sessionSetItem).not.toHaveBeenCalled();
    });
  });

  describe('authRequestConfig', () => {
    it('bearer mode: returns an Authorization header when a handle is set', () => {
      isAdoEmbedded.mockReturnValue(true);
      setBearerHandle('the-handle');

      expect(authRequestConfig()).toEqual({ headers: { Authorization: 'Bearer the-handle' } });
    });

    it('bearer mode: returns no headers when no handle is set yet', () => {
      isAdoEmbedded.mockReturnValue(true);

      expect(authRequestConfig()).toEqual({});
    });

    it('cookie mode: sets withCredentials and reads the CSRF token from the __Host-docgen_csrf cookie', () => {
      isAdoEmbedded.mockReturnValue(false);
      vi.stubGlobal('document', { cookie: 'other=x; __Host-docgen_csrf=the-csrf-token; another=y' });

      expect(authRequestConfig()).toEqual({
        withCredentials: true,
        headers: { 'X-Csrf-Token': 'the-csrf-token' },
      });
    });

    it('cookie mode: omits the CSRF header entirely when no csrf cookie is present yet', () => {
      isAdoEmbedded.mockReturnValue(false);
      vi.stubGlobal('document', { cookie: '' });

      expect(authRequestConfig()).toEqual({ withCredentials: true, headers: {} });
    });

    it('cookie mode: URL-decodes the csrf cookie value', () => {
      isAdoEmbedded.mockReturnValue(false);
      vi.stubGlobal('document', { cookie: '__Host-docgen_csrf=a%20b%3Dc' });

      expect(authRequestConfig().headers['X-Csrf-Token']).toBe('a b=c');
    });
  });
});
