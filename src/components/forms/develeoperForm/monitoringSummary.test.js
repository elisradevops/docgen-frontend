import { describe, expect, test } from 'vitest';
import {
  buildHealthSentence,
  buildRunsSentence,
  buildIssueContextSentence,
  formatRelativeTime,
  formatSignature,
  issueMetaTokens,
  issueHasBaselineContext,
} from './monitoringSummary';

describe('buildHealthSentence', () => {
  test('reports all clear when every service is up', () => {
    const services = [{ key: 'api-gate', status: 'up' }, { key: 'content-control', status: 'up' }];
    expect(buildHealthSentence(services)).toBe('All services are healthy.');
  });

  test('reports no services monitored the same as all clear', () => {
    expect(buildHealthSentence([])).toBe('All services are healthy.');
    expect(buildHealthSentence(undefined)).toBe('All services are healthy.');
  });

  test('names a degraded service', () => {
    const services = [{ key: 'download-manager', displayName: 'download-manager', status: 'degraded' }];
    expect(buildHealthSentence(services)).toBe('download-manager is degraded.');
  });

  test('names a down service distinctly from a degraded one, joining multiple clauses', () => {
    const services = [
      { key: 'mongodb', displayName: 'mongodb', status: 'down' },
      { key: 'minio', displayName: 'minio', status: 'degraded' },
    ];
    expect(buildHealthSentence(services)).toBe('mongodb is down, minio is degraded.');
  });

  test('inspects nested dependencies, not just top-level services', () => {
    const services = [
      { key: 'api-gate', status: 'up', dependencies: [{ key: 'mongodb', displayName: 'mongodb', status: 'down' }] },
    ];
    expect(buildHealthSentence(services)).toBe('mongodb is down.');
  });
});

describe('buildRunsSentence', () => {
  test('returns an empty string when overview has not loaded', () => {
    expect(buildRunsSentence(undefined)).toBe('');
  });

  test('reports the total with no regression clause when there are none', () => {
    const overview = { runs: { windowHours: 24, total: 248 }, issues: { regressed: 0 } };
    expect(buildRunsSentence(overview)).toBe('248 runs in the last 24 hours.');
  });

  test('uses singular "run" for a total of exactly one', () => {
    const overview = { runs: { windowHours: 24, total: 1 }, issues: { regressed: 0 } };
    expect(buildRunsSentence(overview)).toBe('1 run in the last 24 hours.');
  });

  test('appends a singular regression clause', () => {
    const overview = { runs: { windowHours: 24, total: 248 }, issues: { regressed: 1 } };
    expect(buildRunsSentence(overview)).toBe('248 runs in the last 24 hours, including 1 regression.');
  });

  test('appends a plural regression clause', () => {
    const overview = { runs: { windowHours: 24, total: 248 }, issues: { regressed: 3 } };
    expect(buildRunsSentence(overview)).toBe('248 runs in the last 24 hours, including 3 regressions.');
  });
});

describe('formatSignature', () => {
  test('replaces <n> placeholder with an ellipsis', () => {
    expect(formatSignature('request failed with status code <n>')).toBe('request failed with status code …');
  });

  test('replaces <n> embedded within a token', () => {
    expect(formatSignature('getaddrinfo enotfound s<n>')).toBe('getaddrinfo enotfound s…');
  });

  test('replaces multiple occurrences', () => {
    expect(formatSignature('suite <n> step <n>')).toBe('suite … step …');
  });

  test('returns an empty string for a missing signature', () => {
    expect(formatSignature(undefined)).toBe('');
    expect(formatSignature('')).toBe('');
  });

  test('passes through a signature with no placeholder unchanged', () => {
    expect(formatSignature('file upload failed')).toBe('file upload failed');
  });
});

describe('issueMetaTokens', () => {
  test('always includes the service as the first token', () => {
    const tokens = issueMetaTokens({ service: 'dg-content-control' });
    expect(tokens[0]).toBe('dg-content-control');
  });

  test('includes project and docType when both are available', () => {
    const issue = { service: 'dg-content-control', projects: ['Cube-ADCS'], docTypes: ['SVD'] };
    expect(issueMetaTokens(issue)).toEqual(['dg-content-control', 'Cube-ADCS', 'SVD']);
  });

  test('omits project when the array is empty (infrastructure-level error)', () => {
    const issue = { service: 'dg-api-gate', projects: [], docTypes: [] };
    expect(issueMetaTokens(issue)).toEqual(['dg-api-gate']);
  });

  test('falls back to "unknown service" when service is missing', () => {
    expect(issueMetaTokens({})[0]).toBe('unknown service');
  });
});

describe('issueHasBaselineContext', () => {
  test('true when the issue has a runId and a project', () => {
    const issue = { occurrenceRunIds: ['abc'], projects: ['Cube-ADCS'], docTypes: [] };
    expect(issueHasBaselineContext(issue)).toBe(true);
  });

  test('true when the issue has a runId and a docType but no project', () => {
    const issue = { occurrenceRunIds: ['abc'], projects: [], docTypes: ['SVD'] };
    expect(issueHasBaselineContext(issue)).toBe(true);
  });

  test('false when the issue has runIds but no project or docType (infrastructure error)', () => {
    const issue = { occurrenceRunIds: ['abc'], projects: [], docTypes: [] };
    expect(issueHasBaselineContext(issue)).toBe(false);
  });

  test('false when there are no runIds at all', () => {
    const issue = { occurrenceRunIds: [], projects: ['Cube-ADCS'], docTypes: ['SVD'] };
    expect(issueHasBaselineContext(issue)).toBe(false);
  });
});

describe('buildIssueContextSentence (deprecated, kept for backward compat)', () => {
  test('joins meta tokens into a readable sentence', () => {
    const issue = { service: 'dg-content-control', projects: ['Cube-ADCS'], docTypes: ['SVD'] };
    expect(buildIssueContextSentence(issue)).toBe('In dg-content-control, Cube-ADCS, SVD.');
  });

  test('falls back to just the service when no project or docType is known', () => {
    expect(buildIssueContextSentence({ service: 'json-to-word' })).toBe('In json-to-word.');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-25T12:00:00Z');

  test('returns an empty string for a missing date', () => {
    expect(formatRelativeTime(undefined, now)).toBe('');
  });

  test('reports "just now" under a minute', () => {
    expect(formatRelativeTime(new Date('2026-09-25T11:59:30Z'), now)).toBe('just now');
  });

  test('reports whole minutes under an hour', () => {
    expect(formatRelativeTime(new Date('2026-09-25T11:48:00Z'), now)).toBe('12 minutes ago');
  });

  test('reports one decimal place of hours under a day', () => {
    expect(formatRelativeTime(new Date('2026-09-25T09:36:00Z'), now)).toBe('2.4 hours ago');
  });

  test('reports whole days at a day or more', () => {
    expect(formatRelativeTime(new Date('2026-09-19T12:00:00Z'), now)).toBe('6 days ago');
  });
});
