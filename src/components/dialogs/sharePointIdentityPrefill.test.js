import { describe, expect, test } from 'vitest';
import { resolveIdentityPrefill } from './sharePointIdentityPrefill';

describe('resolveIdentityPrefill', () => {
  test('fills both fields when both are currently empty and a full hint is available', () => {
    const result = resolveIdentityPrefill({ hint: { domain: 'GALAXY', account: 'EdenS' }, username: '', domain: '' });
    expect(result).toEqual({ username: 'EdenS', domain: 'GALAXY' });
  });

  test('preserves a user-typed username, still fills the empty domain', () => {
    const result = resolveIdentityPrefill({
      hint: { domain: 'GALAXY', account: 'EdenS' },
      username: 'someone.else',
      domain: '',
    });
    expect(result).toEqual({ username: 'someone.else', domain: 'GALAXY' });
  });

  test('preserves both fields when both are already user-typed (no-clobber guarantee)', () => {
    const result = resolveIdentityPrefill({
      hint: { domain: 'GALAXY', account: 'EdenS' },
      username: 'someone.else',
      domain: 'OTHERDOMAIN',
    });
    expect(result).toEqual({ username: 'someone.else', domain: 'OTHERDOMAIN' });
  });

  test('leaves both fields empty when the hint is a null/null miss', () => {
    const result = resolveIdentityPrefill({ hint: { domain: null, account: null }, username: '', domain: '' });
    expect(result).toEqual({ username: '', domain: '' });
  });

  test('leaves both fields empty when hint itself is null', () => {
    const result = resolveIdentityPrefill({ hint: null, username: '', domain: '' });
    expect(result).toEqual({ username: '', domain: '' });
  });

  test('treats a whitespace-only current value as empty', () => {
    const result = resolveIdentityPrefill({ hint: { domain: 'GALAXY', account: 'EdenS' }, username: '   ', domain: '' });
    expect(result).toEqual({ username: 'EdenS', domain: 'GALAXY' });
  });
});
