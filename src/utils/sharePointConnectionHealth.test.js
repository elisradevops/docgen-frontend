import { describe, expect, it } from 'vitest';
import { isOnlineSharePointUrl, describeConnectionHealth } from './sharePointConnectionHealth';

describe('isOnlineSharePointUrl', () => {
  it('recognizes a sharepoint.com URL as Online', () => {
    expect(isOnlineSharePointUrl('https://tenant.sharepoint.com/sites/x')).toBe(true);
  });

  it('treats an on-prem farm URL as not Online', () => {
    expect(isOnlineSharePointUrl('http://sp-server/sites/x')).toBe(false);
  });

  it('handles missing/empty input without throwing', () => {
    expect(isOnlineSharePointUrl('')).toBe(false);
    expect(isOnlineSharePointUrl(null)).toBe(false);
    expect(isOnlineSharePointUrl(undefined)).toBe(false);
  });
});

describe('describeConnectionHealth', () => {
  it('maps healthy to a success severity and a connected message', () => {
    const result = describeConnectionHealth('healthy');
    expect(result.severity).toBe('success');
    expect(result.message).toMatch(/connected/i);
  });

  it('maps unhealthy to an error severity and a reconnect message', () => {
    const result = describeConnectionHealth('unhealthy');
    expect(result.severity).toBe('error');
    expect(result.message).toMatch(/reconnect/i);
  });

  it('maps checking to an info severity', () => {
    expect(describeConnectionHealth('checking').severity).toBe('info');
  });

  it('maps no-session (and any unrecognized status) to a warning severity', () => {
    expect(describeConnectionHealth('no-session').severity).toBe('warning');
    expect(describeConnectionHealth('something-unexpected').severity).toBe('warning');
  });

  it('maps healthy-unsaved to an info severity, connected but not alarming', () => {
    const result = describeConnectionHealth('healthy-unsaved');
    expect(result.severity).toBe('info');
    expect(result.message).toMatch(/connected/i);
    // Must not read like the "nothing is working" no-session warning.
    expect(result.message).not.toMatch(/reconnect to sync/i);
  });
});
