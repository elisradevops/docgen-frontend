import { describe, expect, test } from 'vitest';
import {
  computeFilesToSkip,
  computeDocTypeOverrides,
  guessDocTypeFromFilename,
  orderRowsForReview,
} from './sharePointReview';

const DOC_TYPES = ['STD', 'STP', 'STR', 'SVD', 'SRS', 'SYSRS', 'MEETING-SUMMARY'];

describe('computeFilesToSkip', () => {
  const conflicts = [
    { name: 'STD/a.dotx', relativePath: 'STD/a.dotx' },
    { name: 'STD/b.dotx', relativePath: 'STD/b.dotx' },
  ];
  const newFiles = [
    { name: 'SVD/c.dotx', relativePath: 'SVD/c.dotx' },
    { name: 'SVD/d.dotx', relativePath: 'SVD/d.dotx' },
  ];

  test('returns an empty list when every file is selected', () => {
    const selected = ['STD/a.dotx', 'STD/b.dotx', 'SVD/c.dotx', 'SVD/d.dotx'];
    expect(computeFilesToSkip(conflicts, newFiles, selected)).toEqual([]);
  });

  test('skips an unselected conflict', () => {
    const selected = ['STD/b.dotx', 'SVD/c.dotx', 'SVD/d.dotx'];
    expect(computeFilesToSkip(conflicts, newFiles, selected)).toEqual(['STD/a.dotx']);
  });

  test('skips an unselected new file — the actual gap this task fixes: new files were never skippable before', () => {
    const selected = ['STD/a.dotx', 'STD/b.dotx', 'SVD/c.dotx'];
    expect(computeFilesToSkip(conflicts, newFiles, selected)).toEqual(['SVD/d.dotx']);
  });

  test('handles empty conflicts/newFiles arrays', () => {
    expect(computeFilesToSkip([], [], [])).toEqual([]);
  });

  test('distinguishes duplicate basenames living under different relativePaths', () => {
    const dupConflicts = [{ name: 'a.dotx', relativePath: 'STD/a.dotx' }];
    const dupNewFiles = [{ name: 'a.dotx', relativePath: 'SVD/a.dotx' }];
    const selected = ['STD/a.dotx']; // only the STD one is checked
    expect(computeFilesToSkip(dupConflicts, dupNewFiles, selected)).toEqual(['SVD/a.dotx']);
  });
});

describe('computeDocTypeOverrides', () => {
  const conflicts = [{ name: 'file1.dotx', relativePath: 'file1.dotx' }];
  const newFiles = [
    { name: 'file2.dotx', relativePath: 'STD/file2.dotx' },
    { name: 'file3.dotx', relativePath: 'file3.dotx' },
  ];

  test('includes an override for every selected row with a chosen docType', () => {
    const selected = ['file1.dotx', 'STD/file2.dotx', 'file3.dotx'];
    const docTypeByPath = { 'file1.dotx': 'SVD', 'STD/file2.dotx': 'STD', 'file3.dotx': 'STR' };
    expect(computeDocTypeOverrides(conflicts, newFiles, selected, docTypeByPath)).toEqual({
      'file1.dotx': 'SVD',
      'STD/file2.dotx': 'STD',
      'file3.dotx': 'STR',
    });
  });

  test('omits a selected row with no docType chosen yet', () => {
    const selected = ['file1.dotx', 'file3.dotx'];
    const docTypeByPath = { 'file1.dotx': 'SVD', 'file3.dotx': '' };
    expect(computeDocTypeOverrides(conflicts, newFiles, selected, docTypeByPath)).toEqual({
      'file1.dotx': 'SVD',
    });
  });

  test('omits an unselected row even if it has a docType chosen', () => {
    const selected = ['file1.dotx'];
    const docTypeByPath = { 'file1.dotx': 'SVD', 'file3.dotx': 'STR' };
    expect(computeDocTypeOverrides(conflicts, newFiles, selected, docTypeByPath)).toEqual({
      'file1.dotx': 'SVD',
    });
  });
});

describe('guessDocTypeFromFilename', () => {
  test('matches a simple valid type in the filename', () => {
    expect(guessDocTypeFromFilename('STD-template.dotx', DOC_TYPES)).toBe('STD');
  });

  test('SYSRS does not false-match as SRS — different whole tokens, not a substring collision', () => {
    expect(guessDocTypeFromFilename('SYSRS_template.docx', DOC_TYPES)).toBe('SYSRS');
  });

  test('SRS filename does not match SYSRS either — exact token, not the longer type', () => {
    expect(guessDocTypeFromFilename('Project-SRS-v1.docx', DOC_TYPES)).toBe('SRS');
  });

  test('does not match mid-word — "Instructions" must not false-match "STR"', () => {
    expect(guessDocTypeFromFilename('Instructions.docx', DOC_TYPES)).toBe('');
  });

  test('normalizes separators — "Meeting Summary.docx" matches "MEETING-SUMMARY"', () => {
    expect(guessDocTypeFromFilename('Meeting Summary.docx', DOC_TYPES)).toBe('MEETING-SUMMARY');
  });

  test('normalizes underscores too — "Meeting_Summary_v2.docx" matches "MEETING-SUMMARY"', () => {
    expect(guessDocTypeFromFilename('Meeting_Summary_v2.docx', DOC_TYPES)).toBe('MEETING-SUMMARY');
  });

  test('returns the caller\'s original casing from validTypes, not an uppercased variant', () => {
    expect(guessDocTypeFromFilename('std-template.dotx', ['Std', 'Svd'])).toBe('Std');
  });

  test('a longer (more-token) match wins over a shorter one it contains', () => {
    const types = ['SYSTEM', 'SYSTEM REQUIREMENTS'];
    expect(guessDocTypeFromFilename('SYSTEM_REQUIREMENTS_v2.docx', types)).toBe('SYSTEM REQUIREMENTS');
  });

  test('returns empty string when nothing matches', () => {
    expect(guessDocTypeFromFilename('random-file-name.docx', DOC_TYPES)).toBe('');
  });

  test('returns empty string when validTypes is empty', () => {
    expect(guessDocTypeFromFilename('STD-template.dotx', [])).toBe('');
  });

  test('handles a missing/empty filename without throwing', () => {
    expect(guessDocTypeFromFilename('', DOC_TYPES)).toBe('');
    expect(guessDocTypeFromFilename(undefined, DOC_TYPES)).toBe('');
  });
});

describe('orderRowsForReview', () => {
  const conflicts = [
    { relativePath: 'STD/a.dotx' }, // typed
    { relativePath: 'flat-b.dotx' }, // needs type
  ];
  const newFiles = [
    { relativePath: 'flat-c.dotx' }, // needs type
    { relativePath: 'STD/d.dotx' }, // typed
  ];

  test('puts every needs-a-type row before every already-typed row', () => {
    const docTypeByPath = { 'STD/a.dotx': 'STD', 'flat-b.dotx': '', 'flat-c.dotx': '', 'STD/d.dotx': 'STD' };
    const ordered = orderRowsForReview(conflicts, newFiles, docTypeByPath);
    expect(ordered.map((r) => r.file.relativePath)).toEqual(['flat-b.dotx', 'flat-c.dotx', 'STD/a.dotx', 'STD/d.dotx']);
  });

  test('preserves conflicts-before-newFiles ordering within each group (stable partition)', () => {
    const docTypeByPath = { 'STD/a.dotx': 'STD', 'flat-b.dotx': '', 'flat-c.dotx': '', 'STD/d.dotx': 'STD' };
    const ordered = orderRowsForReview(conflicts, newFiles, docTypeByPath);
    // Within "needs a type": flat-b (conflict) before flat-c (new file).
    expect(ordered[0].isConflict).toBe(true);
    expect(ordered[1].isConflict).toBe(false);
    // Within "typed": STD/a (conflict) before STD/d (new file).
    expect(ordered[2].isConflict).toBe(true);
    expect(ordered[3].isConflict).toBe(false);
  });

  test('a row missing from docTypeByPath entirely counts as needing a type', () => {
    const docTypeByPath = { 'STD/a.dotx': 'STD' };
    const ordered = orderRowsForReview([{ relativePath: 'STD/a.dotx' }], [{ relativePath: 'no-entry.dotx' }], docTypeByPath);
    expect(ordered.map((r) => r.file.relativePath)).toEqual(['no-entry.dotx', 'STD/a.dotx']);
  });

  test('handles empty conflicts/newFiles arrays', () => {
    expect(orderRowsForReview([], [], {})).toEqual([]);
  });
});
