import { describe, expect, test } from 'vitest';
import { describeColumnDrift, hasColumnDrift, pruneStaleFieldConfig } from './columnDrift';

describe('describeColumnDrift', () => {
  test('resolves a dropped column label from the query\'s prior columns snapshot when no rename exists', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [{ referenceName: 'System.NodeName', name: 'Node Name' }], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['System.NodeName', 'Custom.CustomerRequirementId'] } };
    const queries = {
      'req-test': { columns: [{ referenceName: 'Custom.CustomerRequirementId', name: 'CustomerRequirementId' }] },
    };

    const drift = describeColumnDrift(fieldsByQuery, queries, fieldOrder, {}, {});

    expect(drift.dropped).toEqual([{ label: 'CustomerRequirementId', wasRenamed: false, wasHidden: false }]);
    expect(drift.added).toEqual([]);
  });

  test('falls back to the raw referenceName when no prior name snapshot is available', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['Custom.CustomerRequirementId'] } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, {}, {});

    expect(drift.dropped).toEqual([{ label: 'Custom.CustomerRequirementId', wasRenamed: false, wasHidden: false }]);
  });

  test('reports dropped columns using a rename override when present, tagged as renamed', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['CustomerRequirementId'] } };
    const fieldDisplayMapping = { 'req-test': { Requirement: { CustomerRequirementId: 'Customer ID' } } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, fieldDisplayMapping, {});

    expect(drift.dropped).toEqual([{ label: 'Customer ID', wasRenamed: true, wasHidden: false }]);
  });

  test('tags a dropped column that was hidden', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['CustomerRequirementId'] } };
    const fieldVisibility = { 'req-test': { Requirement: { CustomerRequirementId: false } } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, {}, fieldVisibility);

    expect(drift.dropped).toEqual([{ label: 'CustomerRequirementId', wasRenamed: false, wasHidden: true }]);
  });

  test('does not flag ALWAYS_VISIBLE_REFS/EXCLUDED_FIELD_REFS as dropped — deriveFieldList excludes them by design, not because ADO removed them', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [{ referenceName: 'System.NodeName', name: 'Node Name' }], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    // Legacy saved order containing System.Id (with an old rename) and System.WorkItemType —
    // both are permanently excluded from fieldsByQuery, so they'd look "dropped" every time.
    const fieldOrder = { 'req-test': { Requirement: ['System.NodeName', 'System.Id', 'System.WorkItemType'] } };
    const fieldDisplayMapping = { 'req-test': { Requirement: { 'System.Id': 'System Id' } } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, fieldDisplayMapping, {});

    expect(drift.dropped).toEqual([]);
  });

  test('reports added columns not present in saved fieldOrder', () => {
    const fieldsByQuery = {
      'req-test': {
        Requirement: [
          { referenceName: 'System.NodeName', name: 'Node Name' },
          { referenceName: 'Microsoft.VSTS.Common.Severity', name: 'Severity' },
        ],
        'Test Case': [],
      },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['System.NodeName'] } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, {}, {});

    expect(drift.dropped).toEqual([]);
    expect(drift.added).toEqual(['Severity']);
  });

  test('skips sides with no saved order (nothing to compare yet)', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [{ referenceName: 'System.NodeName', name: 'Node Name' }], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };

    const drift = describeColumnDrift(fieldsByQuery, {}, {}, {}, {});

    expect(drift).toEqual({ dropped: [], added: [] });
  });
});

describe('hasColumnDrift', () => {
  test('false when both lists are empty', () => {
    expect(hasColumnDrift({ dropped: [], added: [] })).toBe(false);
  });

  test('true when there are dropped columns', () => {
    expect(hasColumnDrift({ dropped: [{ label: 'X', wasRenamed: false, wasHidden: false }], added: [] })).toBe(true);
  });

  test('true when there are added columns', () => {
    expect(hasColumnDrift({ dropped: [], added: ['Severity'] })).toBe(true);
  });
});

describe('pruneStaleFieldConfig', () => {
  const fieldsByQuery = {
    'req-test': { Requirement: [{ referenceName: 'System.NodeName', name: 'Node Name' }], 'Test Case': [] },
    'test-req': { Requirement: [], 'Test Case': [] },
  };
  const reqTestQuery = { id: 'q1' };

  test('removes a dropped referenceName from fieldOrder, fieldVisibility, and fieldDisplayMapping', () => {
    const fieldOrder = { 'req-test': { Requirement: ['System.NodeName', 'CustomerRequirementId'] } };
    const fieldVisibility = { 'req-test': { Requirement: { CustomerRequirementId: false } } };
    const fieldDisplayMapping = { 'req-test': { Requirement: { CustomerRequirementId: 'Customer ID' } } };

    const result = pruneStaleFieldConfig(
      fieldsByQuery,
      { 'req-test': reqTestQuery },
      fieldOrder,
      fieldVisibility,
      fieldDisplayMapping
    );

    expect(result.changed).toBe(true);
    expect(result.fieldOrder['req-test'].Requirement).toEqual(['System.NodeName']);
    expect(result.fieldVisibility['req-test'].Requirement).toEqual({});
    expect(result.fieldDisplayMapping['req-test'].Requirement).toEqual({});
  });

  test('returns the original object references when nothing needs pruning (identity-stable)', () => {
    const fieldOrder = { 'req-test': { Requirement: ['System.NodeName'] } };
    const fieldVisibility = {};
    const fieldDisplayMapping = {};

    const result = pruneStaleFieldConfig(
      fieldsByQuery,
      { 'req-test': reqTestQuery },
      fieldOrder,
      fieldVisibility,
      fieldDisplayMapping
    );

    expect(result.changed).toBe(false);
    expect(result.fieldOrder).toBe(fieldOrder);
    expect(result.fieldVisibility).toBe(fieldVisibility);
    expect(result.fieldDisplayMapping).toBe(fieldDisplayMapping);
  });

  test('leaves an inactive direction (no query selected) untouched even if its saved refs look stale', () => {
    const fieldOrder = { 'test-req': { Requirement: ['SomeStaleRef'] } };

    const result = pruneStaleFieldConfig(
      fieldsByQuery,
      { 'req-test': reqTestQuery, 'test-req': null },
      fieldOrder,
      {},
      {}
    );

    expect(result.changed).toBe(false);
    expect(result.fieldOrder).toBe(fieldOrder);
  });
});
