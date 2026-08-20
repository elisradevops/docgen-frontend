import { describe, expect, test } from 'vitest';
import { buildFolderPreviewMessage } from './sharePointFolderPreview';

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

  test('every found subfolder is invalid — error, cannot connect', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'General', name: 'General/c.dotx' }],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('error');
    expect(result.canConnect).toBe(false);
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

  test('files exist but none carry a subfolder-derived docType — same message as no files at all', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: '', name: 'a.dotx' }, { name: 'b.dotx' }],
      documentTypes: DOC_TYPES,
    });
    expect(result.status).toBe('error');
    expect(result.canConnect).toBe(false);
    expect(result.message).toContain('No template-type subfolders found here');
    expect(result.message).not.toContain('()');
  });

  test('documentTypes unavailable (e.g. no project selected) — cannot judge validity, degrades to success', () => {
    const result = buildFolderPreviewMessage({
      files: [{ docType: 'AnythingAtAll', name: 'AnythingAtAll/c.dotx' }],
      documentTypes: [],
    });
    expect(result.status).toBe('success');
    expect(result.canConnect).toBe(true);
  });
});
