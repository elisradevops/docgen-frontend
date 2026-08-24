import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('./authPopup', () => ({ openAuthPopup: vi.fn() }));
vi.mock('./authTransport', () => ({
  getTransportMode: vi.fn(),
  setBearerHandle: vi.fn(),
  clearBearerHandle: vi.fn(),
  authRequestConfig: vi.fn(() => ({})),
}));
vi.mock('../store/constants', () => ({ default: { jsonDocument_url: 'https://api.docgen.example.com' } }));

import axios from 'axios';
import { openAuthPopup } from './authPopup';
import { getTransportMode, setBearerHandle, clearBearerHandle, authRequestConfig } from './authTransport';
import { signIn, getSessionInfo, signOut, isReauthRequired } from './sharePointSession';

describe('sharePointSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signIn', () => {
    it('cookie mode: opens the popup with no mode param and never exchanges a handle code', async () => {
      getTransportMode.mockReturnValue('cookie');
      openAuthPopup.mockResolvedValueOnce({});

      await signIn();

      expect(openAuthPopup).toHaveBeenCalledWith({ apiBaseUrl: 'https://api.docgen.example.com', mode: undefined });
      expect(axios.post).not.toHaveBeenCalled();
      expect(setBearerHandle).not.toHaveBeenCalled();
    });

    it('bearer mode: opens the popup with mode=ado, then exchanges the handle code for a session token', async () => {
      getTransportMode.mockReturnValue('bearer');
      openAuthPopup.mockResolvedValueOnce({ handleCode: 'the-handle-code' });
      axios.post.mockResolvedValueOnce({ data: { sessionToken: 'the-session-token' } });

      await signIn();

      expect(openAuthPopup).toHaveBeenCalledWith({ apiBaseUrl: 'https://api.docgen.example.com', mode: 'ado' });
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.docgen.example.com/auth/session/exchange',
        { handleCode: 'the-handle-code' },
        expect.anything()
      );
      expect(setBearerHandle).toHaveBeenCalledWith('the-session-token');
    });

    it('propagates a popup rejection (e.g. popup_blocked) without exchanging anything', async () => {
      getTransportMode.mockReturnValue('bearer');
      openAuthPopup.mockRejectedValueOnce(Object.assign(new Error('blocked'), { code: 'popup_blocked' }));

      await expect(signIn()).rejects.toMatchObject({ code: 'popup_blocked' });
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('getSessionInfo', () => {
    it('spreads authRequestConfig() into the request and returns the response data', async () => {
      authRequestConfig.mockReturnValue({ withCredentials: true, headers: { 'X-Csrf-Token': 'x' } });
      axios.get.mockResolvedValueOnce({ data: { success: true, displayName: 'Eden' } });

      const result = await getSessionInfo();

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.docgen.example.com/auth/session',
        expect.objectContaining({ withCredentials: true, headers: { 'X-Csrf-Token': 'x' } })
      );
      expect(result).toEqual({ success: true, displayName: 'Eden' });
    });
  });

  describe('signOut', () => {
    it('posts to /auth/logout and clears the bearer handle on success', async () => {
      axios.post.mockResolvedValueOnce({ data: { success: true } });

      await signOut();

      expect(axios.post).toHaveBeenCalledWith('https://api.docgen.example.com/auth/logout', {}, expect.anything());
      expect(clearBearerHandle).toHaveBeenCalled();
    });

    it('still clears the bearer handle even when the network call fails', async () => {
      axios.post.mockRejectedValueOnce(new Error('network down'));

      await expect(signOut()).rejects.toThrow('network down');
      expect(clearBearerHandle).toHaveBeenCalled();
    });
  });

  describe('isReauthRequired', () => {
    it('recognizes a 401 with error:"reauth_required"', () => {
      const error = { response: { status: 401, data: { error: 'reauth_required' } } };
      expect(isReauthRequired(error)).toBe(true);
    });

    it('does not recognize a plain 401 with a different error body', () => {
      const error = { response: { status: 401, data: { error: 'invalid_token' } } };
      expect(isReauthRequired(error)).toBe(false);
    });

    it('does not recognize a non-401 status', () => {
      const error = { response: { status: 500, data: { error: 'reauth_required' } } };
      expect(isReauthRequired(error)).toBe(false);
    });

    it('handles a missing response object without throwing', () => {
      expect(() => isReauthRequired(new Error('network error'))).not.toThrow();
      expect(isReauthRequired(new Error('network error'))).toBe(false);
    });

    it('recognizes the docManagerApi-wrapped shape (.status/.code instead of .response.*)', () => {
      const wrapped = Object.assign(new Error('reauth_required'), { status: 401, code: 'reauth_required' });
      expect(isReauthRequired(wrapped)).toBe(true);
    });

    it('does not recognize a wrapped 401 with a different code', () => {
      const wrapped = Object.assign(new Error('nope'), { status: 401, code: 'invalid_token' });
      expect(isReauthRequired(wrapped)).toBe(false);
    });
  });
});
