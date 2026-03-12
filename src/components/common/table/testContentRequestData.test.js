import { describe, expect, test } from 'vitest';
import { buildTestContentRequestData, mapSuiteTextList } from './testContentRequestData';

describe('testContentRequestData', () => {
  test('maps suite labels with stable fallbacks', () => {
    const result = mapSuiteTextList([
      { text: 'Suite A - (1)' },
      { name: 'Suite B', id: 2 },
      { key: 3 },
      {},
      null,
    ]);

    expect(result).toEqual(['Suite A - (1)', 'Suite B', '3']);
  });

  test('STD keeps includeHardCopyRun and omits flatten parameter', () => {
    const data = buildTestContentRequestData({
      selectedTestPlanKey: 12,
      selectedTestPlanText: 'Plan 12',
      testSuiteIdList: [10, 11],
      selectedTestSuites: [{ text: 'Suite X' }],
      isSuiteSpecific: true,
      nonRecursiveTestSuiteIdList: [10],
      includeAttachments: true,
      attachmentType: 'asEmbedded',
      includeHardCopyRun: true,
      includeAttachmentContent: false,
      includeRequirements: true,
      includeCustomerId: false,
      traceAnalysisRequest: { traceAnalysisMode: 'none' },
      linkedMomRequest: { linkedMomMode: 'none' },
      isStpMode: false,
    });

    expect(data.includeHardCopyRun).toBe(true);
    expect(data).not.toHaveProperty('flatSuiteTestCases');
  });

  test('STP forces includeHardCopyRun=false and omits flatten parameter', () => {
    const data = buildTestContentRequestData({
      selectedTestPlanKey: 20,
      selectedTestPlanText: 'Plan 20',
      testSuiteIdList: [33],
      selectedTestSuites: [{ text: 'Suite Y' }],
      isSuiteSpecific: true,
      nonRecursiveTestSuiteIdList: [33],
      includeAttachments: false,
      attachmentType: 'asLinked',
      includeHardCopyRun: true,
      includeAttachmentContent: false,
      includeRequirements: false,
      includeCustomerId: false,
      traceAnalysisRequest: { traceAnalysisMode: 'none' },
      linkedMomRequest: { linkedMomMode: 'none' },
      isStpMode: true,
    });

    expect(data.includeHardCopyRun).toBe(false);
    expect(data).not.toHaveProperty('flatSuiteTestCases');
  });
});
