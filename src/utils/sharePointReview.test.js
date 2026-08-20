import { describe, expect, test } from 'vitest';
import { computeFilesToSkip } from './sharePointReview';

describe('computeFilesToSkip', () => {
  const conflicts = [{ name: 'STD/a.dotx' }, { name: 'STD/b.dotx' }];
  const newFiles = [{ name: 'SVD/c.dotx' }, { name: 'SVD/d.dotx' }];

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
});
