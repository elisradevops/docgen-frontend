import { describe, expect, test } from 'vitest';
import {
  formatDateTime,
  isHistoricalCompareResultCurrent,
  toIsoOrEmpty,
  toLocalDateTimeInputValue,
  validateHistoricalCompareInputs,
} from './historicalQueryUtils';

describe('historicalQueryUtils', () => {
  test('toIsoOrEmpty returns empty for invalid values', () => {
    expect(toIsoOrEmpty('')).toBe('');
    expect(toIsoOrEmpty('not-a-date')).toBe('');
  });

  test('toLocalDateTimeInputValue returns datetime-local compatible value', () => {
    const value = toLocalDateTimeInputValue('2026-01-01T10:20:00.000Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test('formatDateTime returns 12-hour date-time with AM/PM', () => {
    const value = formatDateTime('2026-03-31T13:05:00');
    expect(value).toBe('31/03/2026, 01:05 PM');
  });

  test('isHistoricalCompareResultCurrent returns true when query and timestamps match current inputs', () => {
    const result = {
      queryId: 'q-123',
      baseline: { asOf: '2026-03-31T08:00:00.000Z' },
      compareTo: { asOf: '2026-03-31T09:00:00.000Z' },
    };
    expect(
      isHistoricalCompareResultCurrent(
        result,
        'q-123',
        '2026-03-31T08:00:00.000Z',
        '2026-03-31T09:00:00.000Z',
      ),
    ).toBe(true);
  });

  test('isHistoricalCompareResultCurrent returns false when compare inputs changed after run', () => {
    const result = {
      queryId: 'q-123',
      baseline: { asOf: '2026-03-31T08:00:00.000Z' },
      compareTo: { asOf: '2026-03-31T09:00:00.000Z' },
    };
    expect(
      isHistoricalCompareResultCurrent(
        result,
        'q-123',
        '2026-03-31T08:30:00.000Z',
        '2026-03-31T09:00:00.000Z',
      ),
    ).toBe(false);
  });

  test('validateHistoricalCompareInputs returns error when query is missing', () => {
    const result = validateHistoricalCompareInputs({
      selectedQueryId: '',
      baselineInput: '2026-03-31T08:00:00.000Z',
      compareToInput: '2026-03-31T09:00:00.000Z',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.query).toBe('Please select a shared query.');
  });

  test('validateHistoricalCompareInputs returns error when baseline is after compare-to', () => {
    const result = validateHistoricalCompareInputs({
      selectedQueryId: 'q-123',
      baselineInput: '2026-03-31T10:00:00.000Z',
      compareToInput: '2026-03-31T09:00:00.000Z',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.order).toBe('Compare To must be later than Baseline.');
  });

  test('validateHistoricalCompareInputs returns valid payload for ordered timestamps', () => {
    const result = validateHistoricalCompareInputs({
      selectedQueryId: 'q-123',
      baselineInput: '2026-03-31T08:00:00.000Z',
      compareToInput: '2026-03-31T09:00:00.000Z',
    });
    expect(result.isValid).toBe(true);
    expect(result.baselineIso).toBe('2026-03-31T08:00:00.000Z');
    expect(result.compareToIso).toBe('2026-03-31T09:00:00.000Z');
  });
});
