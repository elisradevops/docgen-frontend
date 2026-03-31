import { describe, expect, test } from 'vitest';
import { resolveSelectedQueryValue } from './queryTreeUtils';

describe('QueryTree selected value resolution', () => {
  test('uses object.value when present', () => {
    expect(resolveSelectedQueryValue({ value: 'q1', id: 'legacy' })).toBe('q1');
  });

  test('falls back to object.id when value is missing', () => {
    expect(resolveSelectedQueryValue({ id: 'q2' })).toBe('q2');
  });

  test('supports primitive values directly', () => {
    expect(resolveSelectedQueryValue('q3')).toBe('q3');
  });

  test('returns undefined for null', () => {
    expect(resolveSelectedQueryValue(null)).toBeUndefined();
  });
});
