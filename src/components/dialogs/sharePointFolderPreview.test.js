import { describe, expect, test } from 'vitest';
import { buildFolderPreviewMessage, appendScanCaveats } from './sharePointFolderPreview';

const DOC_TYPES = ['STD', 'STP', 'STR', 'SVD', 'SRS', 'SYSRS'];

describe('buildFolderPreviewMessage', () => {
  test('no files at all — error, cannot connect', () => {
    const result = buildFolderPreviewMessage({ files: [], documentTypes: DOC_TYPES });
    expect(result.status).toBe('error');
    expect(result.canConnect).toBe(false);
  });

  test('all found subfolders are valid types — success', () => {
    const result = buildFolderPreviewMessage({
      files: [
        { docType: 'STD', name: 'STD/a.dotx' },
        { docType: 'svd', name: 'SVD/b.dotx' }, // case-insensitive match
      ],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('success');
    expect(result.canConnect).toBe(true);
  });

  test('a mix of valid and invalid subfolders — warning, still connectable', () => {
    const result = buildFolderPreviewMessage({
      files: [
        { docType: 'STD', name: 'STD/a.dotx' },
        { docType: 'old-svd', name: 'old-svd/b.dotx' },
        { docType: 'General', name: 'General/c.dotx' },
      ],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('warning');
    expect(result.canConnect).toBe(true);
    expect(result.message).toContain('old-svd');
    expect(result.message).toContain('General');
    expect(result.message).toContain('STD');
  });

  test('every found subfolder is invalid — warning, still connectable (manual mapping)', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'General', name: 'General/c.dotx' }],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('warning');
    expect(result.canConnect).toBe(true);
    expect(result.message).toContain('General');
  });

  test('a mixed-result message preserves the real (non-canonical) casing of a valid match', () => {
    const result = buildFolderPreviewMessage({
      files: [
        { docType: 'std', name: 'std/a.dotx' }, // valid, but lowercase in SharePoint
        { docType: 'General', name: 'General/c.dotx' },
      ],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('warning');
    // Must show the user's real folder name ("std"), not the uppercased
    // comparison key ("STD") — this was a real bug caught during development.
    expect(result.message).toContain('std');
    expect(result.message).not.toContain('STD will sync');
  });

  test('files exist but none carry a subfolder-derived docType (flat folder) — warning, still connectable', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: '', name: 'a.dotx' }, { name: 'b.dotx' }],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('warning');
    expect(result.canConnect).toBe(true);
    expect(result.message).toContain('assign each file');
  });

  test('no files at all — error even with documentTypes unavailable', () => {
    const result = buildFolderPreviewMessage({ files: [], documentTypes: [] });
    expect(result.status).toBe('error');
    expect(result.canConnect).toBe(false);
  });

  test('documentTypes unavailable (e.g. no project selected) — cannot judge validity, degrades to success', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'AnythingAtAll', name: 'AnythingAtAll/c.dotx' }],
      documentTypes: [],
    });
    expect(result.status).toBe('success');
    expect(result.canConnect).toBe(true);
  });

  test('truncated — downgrades success to warning and stays connectable', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'STD', name: 'STD/a.dotx' }],
      documentTypes: DOC_TYPES,
      truncated: true,
    });
    expect(result.status).toBe('warning');
    expect(result.canConnect).toBe(true);
    expect(result.message).toContain('first 500 files');
  });

  test('skippedFolders — downgrades success to warning, names the folders', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'STD', name: 'STD/a.dotx' }],
      documentTypes: DOC_TYPES,
      skippedFolders: [{ relativePath: 'Archive', reason: 'Access is denied.' }],
    });
    expect(result.status).toBe('warning');
    expect(result.canConnect).toBe(true);
    expect(result.message).toContain('1 folder(s)');
    expect(result.message).toContain('Archive');
  });

  test('both truncated and skippedFolders — both caveats appended', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'STD', name: 'STD/a.dotx' }],
      documentTypes: DOC_TYPES,
      truncated: true,
      skippedFolders: [{ relativePath: 'Archive', reason: 'Access is denied.' }],
    });
    expect(result.status).toBe('warning');
    expect(result.message).toContain('first 500 files');
    expect(result.message).toContain('Archive');
  });

  test('files.length === 0 with skippedFolders — distinct "permissions" message, not the generic empty-folder one', () => {
    const result = buildFolderPreviewMessage({
      files: [],
      documentTypes: DOC_TYPES,
      skippedFolders: [{ relativePath: 'Archive', reason: 'Access is denied.' }],
    });
    expect(result.status).toBe('error');
    expect(result.canConnect).toBe(false);
    expect(result.message).toContain('denied');
    expect(result.message).not.toContain('No template files');
  });

  test('appendScanCaveats never upgrades a status that was already error/warning', () => {
    const errorResult = { status: 'error', canConnect: false, message: 'base' };
    expect(appendScanCaveats(errorResult, { truncated: true }).status).toBe('error');

    const warningResult = { status: 'warning', canConnect: true, message: 'base' };
    expect(appendScanCaveats(warningResult, { truncated: true }).status).toBe('warning');
  });

  test('appendScanCaveats is a no-op when neither caveat applies', () => {
    const result = { status: 'success', canConnect: true, message: 'base' };
    expect(appendScanCaveats(result, { truncated: false, skippedFolders: [] })).toEqual(result);
    expect(appendScanCaveats(result)).toEqual(result);
  });

  test('appendScanCaveats drops the synthetic "…and N more" summary entry from the named list', () => {
    const result = { status: 'success', canConnect: true, message: 'base' };
    const withSummary = appendScanCaveats(result, {
      skippedFolders: [
        { relativePath: 'Archive', reason: 'Access is denied.' },
        { relativePath: '', reason: '…and 5 more folder(s) were also skipped' },
      ],
    });
    expect(withSummary.message).toContain('6 folder(s)');
    expect(withSummary.message).toContain('Archive');
  });
});
