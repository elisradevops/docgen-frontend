// ADO referenceNames + linked-mode pseudo-keys that are always shown and never dragged
export const ALWAYS_VISIBLE_REFS = new Set(['System.Id', 'System.Title', 'Req ID', 'Test Case ID', 'Title']);
export const EXCLUDED_FIELD_REFS = new Set(['System.WorkItemType']);

// Locked columns in linked mode (only Customer ID is configurable)
export const LINKED_REQ_COLUMNS = {
  Requirement: [{ referenceName: 'Customer ID', name: 'Customer ID' }],
  'Test Case': [],
};

// Returns { 'req-test': { Requirement, 'Test Case' }, 'test-req': { Requirement, 'Test Case' } }
export function deriveFieldList(traceAnalysisMode, reqTestQuery, testReqQuery, columnMetadata) {
  if (traceAnalysisMode === 'linkedRequirement') {
    return { 'req-test': LINKED_REQ_COLUMNS, 'test-req': LINKED_REQ_COLUMNS };
  }
  if (traceAnalysisMode !== 'query') {
    return { 'req-test': { Requirement: [], 'Test Case': [] }, 'test-req': { Requirement: [], 'Test Case': [] } };
  }

  const filterMeta = (cols) =>
    (cols || []).filter(
      (c) => c?.referenceName && !EXCLUDED_FIELD_REFS.has(c.referenceName) && !ALWAYS_VISIBLE_REFS.has(c.referenceName)
    );

  const resolveQuerySides = (queryKey) => {
    const meta = columnMetadata?.[queryKey];
    if (meta) {
      return {
        Requirement: filterMeta(meta.Requirement),
        'Test Case': filterMeta(meta['Test Case']),
      };
    }
    // Not yet fetched (or fetch failed): empty for both sides. Never fall back to the query's
    // raw declared columns here — that list isn't split by WIT type, and handing the same
    // unfiltered array to both Requirement and Test Case lets a Requirement-only column get
    // seeded into Test Case's saved fieldOrder if the dialog is used before this resolves.
    return { Requirement: [], 'Test Case': [] };
  };

  return {
    'req-test': resolveQuerySides('req-test'),
    'test-req': resolveQuerySides('test-req'),
  };
}
