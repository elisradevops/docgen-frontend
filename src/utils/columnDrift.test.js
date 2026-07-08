import { describe, expect, test } from 'vitest';
import { describeColumnDrift, hasColumnDrift, pruneStaleFieldConfig } from './columnDrift';

describe('describeColumnDrift', () => {
  test('groups results by query key, using the query title as the group heading', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['Custom.CustomerRequirementId'] } };
    const queries = { 'req-test': { title: 'Req-Test', columns: [] } };

    const drift = describeColumnDrift(fieldsByQuery, queries, fieldOrder, {}, {});

    expect(Object.keys(drift)).toEqual(['req-test']);
    expect(drift['req-test'].title).toBe('Req-Test');
  });

  test('falls back to a generic direction label when the query has no title', () => {
    const fieldsByQuery = { 'req-test': { Requirement: [], 'Test Case': [] }, 'test-req': { Requirement: [], 'Test Case': [] } };
    const fieldOrder = { 'test-req': { Requirement: ['Custom.CustomerRequirementId'] } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, {}, {});

    expect(drift['test-req'].title).toBe('Test Case → Req');
  });

  test('tags each dropped/added entry with its side, so a cross-side ghost is distinguishable', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [{ referenceName: 'Custom.CustomerID', name: 'Customer ID' }], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    // Saved as hidden under Test Case even though it's only valid on Requirement — the exact
    // cross-side ghost bug this feature exists to surface.
    const fieldOrder = { 'req-test': { 'Test Case': ['Custom.CustomerID'] } };
    const fieldVisibility = { 'req-test': { 'Test Case': { 'Custom.CustomerID': false } } };
    const queries = { 'req-test': { title: 'Req-Test' } };

    const drift = describeColumnDrift(fieldsByQuery, queries, fieldOrder, {}, fieldVisibility);

    expect(drift['req-test'].dropped).toEqual([
      { label: 'Custom.CustomerID', side: 'Test Case', wasRenamed: false, wasHidden: true },
    ]);
  });

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

    expect(drift['req-test'].dropped).toEqual([
      { label: 'CustomerRequirementId', side: 'Requirement', wasRenamed: false, wasHidden: false },
    ]);
  });

  test('falls back to the raw referenceName when no prior name snapshot is available', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['Custom.CustomerRequirementId'] } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, {}, {});

    expect(drift['req-test'].dropped[0].label).toBe('Custom.CustomerRequirementId');
  });

  test('reports dropped columns using a rename override when present, tagged as renamed', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };
    const fieldOrder = { 'req-test': { Requirement: ['CustomerRequirementId'] } };
    const fieldDisplayMapping = { 'req-test': { Requirement: { CustomerRequirementId: 'Customer ID' } } };

    const drift = describeColumnDrift(fieldsByQuery, {}, fieldOrder, fieldDisplayMapping, {});

    expect(drift['req-test'].dropped).toEqual([
      { label: 'Customer ID', side: 'Requirement', wasRenamed: true, wasHidden: false },
    ]);
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

    expect(drift).toEqual({});
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

    expect(drift['req-test'].dropped).toEqual([]);
    expect(drift['req-test'].added).toEqual([{ label: 'Severity', side: 'Requirement' }]);
  });

  test('skips sides with no saved order (nothing to compare yet) and omits query keys with no drift', () => {
    const fieldsByQuery = {
      'req-test': { Requirement: [{ referenceName: 'System.NodeName', name: 'Node Name' }], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    };

    const drift = describeColumnDrift(fieldsByQuery, {}, {}, {}, {});

    expect(drift).toEqual({});
  });
});

describe('hasColumnDrift', () => {
  test('false when the drift result has no query keys', () => {
    expect(hasColumnDrift({})).toBe(false);
  });

  test('true when at least one query key has drift', () => {
    expect(hasColumnDrift({ 'req-test': { title: 'Req-Test', dropped: [], added: [{ label: 'X', side: 'Requirement' }] } })).toBe(true);
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
