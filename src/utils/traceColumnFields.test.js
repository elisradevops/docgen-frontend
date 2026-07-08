import { describe, expect, test } from 'vitest';
import { deriveFieldList } from './traceColumnFields';

describe('deriveFieldList', () => {
  test('returns empty arrays for both sides when columnMetadata has no entry for a query (loading / failed fetch)', () => {
    const reqTestQuery = {
      columns: [
        { referenceName: 'System.Id', name: 'ID' },
        { referenceName: 'Custom.CustomerRequirementId', name: 'CustomerRequirementId' },
      ],
    };

    const result = deriveFieldList('query', reqTestQuery, null, {});

    // Must not fall back to the query's raw declared columns — that list isn't split by WIT
    // type, and handing it to both sides is exactly what seeded a Requirement-only column into
    // Test Case's saved fieldOrder.
    expect(result['req-test']).toEqual({ Requirement: [], 'Test Case': [] });
    expect(result['test-req']).toEqual({ Requirement: [], 'Test Case': [] });
  });

  test('uses columnMetadata, split per side, once it has loaded', () => {
    const columnMetadata = {
      'req-test': {
        Requirement: [
          { referenceName: 'System.AssignedTo', name: 'Assigned To' },
          { referenceName: 'Custom.CustomerRequirementId', name: 'CustomerRequirementId' },
        ],
        'Test Case': [{ referenceName: 'System.AssignedTo', name: 'Assigned To' }],
      },
    };

    const result = deriveFieldList('query', {}, null, columnMetadata);

    const reqRefs = result['req-test'].Requirement.map((f) => f.referenceName);
    const tcRefs = result['req-test']['Test Case'].map((f) => f.referenceName);
    expect(reqRefs).toContain('Custom.CustomerRequirementId');
    expect(tcRefs).not.toContain('Custom.CustomerRequirementId');
  });

  test('filters ALWAYS_VISIBLE_REFS and EXCLUDED_FIELD_REFS out of columnMetadata results', () => {
    const columnMetadata = {
      'req-test': {
        Requirement: [
          { referenceName: 'System.Id', name: 'ID' },
          { referenceName: 'System.WorkItemType', name: 'Work Item Type' },
          { referenceName: 'System.Title', name: 'Title' },
          { referenceName: 'System.State', name: 'State' },
        ],
        'Test Case': [],
      },
    };

    const result = deriveFieldList('query', {}, null, columnMetadata);

    expect(result['req-test'].Requirement.map((f) => f.referenceName)).toEqual(['System.State']);
  });

  test('linkedRequirement mode returns the fixed Customer ID pseudo-column, ignoring columnMetadata', () => {
    const result = deriveFieldList('linkedRequirement', {}, {}, {});
    expect(result['req-test'].Requirement).toEqual([{ referenceName: 'Customer ID', name: 'Customer ID' }]);
    expect(result['req-test']['Test Case']).toEqual([]);
  });

  test('non-query, non-linkedRequirement mode returns empty for everything', () => {
    const result = deriveFieldList('none', {}, {}, {});
    expect(result).toEqual({
      'req-test': { Requirement: [], 'Test Case': [] },
      'test-req': { Requirement: [], 'Test Case': [] },
    });
  });
});
