export const mapSuiteTextList = (selectedTestSuites) =>
  Array.isArray(selectedTestSuites)
    ? selectedTestSuites
        .map((s) => s?.text || s?.name || String(s?.id ?? s?.key ?? ''))
        .filter(Boolean)
    : [];

export const buildTestContentRequestData = ({
  selectedTestPlanKey,
  selectedTestPlanText,
  testSuiteIdList,
  selectedTestSuites,
  isSuiteSpecific,
  nonRecursiveTestSuiteIdList,
  includeAttachments,
  attachmentType,
  includeHardCopyRun,
  includeAttachmentContent,
  includeRequirements,
  includeCustomerId,
  traceAnalysisRequest,
  linkedMomRequest,
  isStpMode,
}) => ({
  testPlanId: selectedTestPlanKey,
  testPlanText: selectedTestPlanText || '',
  testSuiteArray: testSuiteIdList,
  testSuiteTextList: mapSuiteTextList(selectedTestSuites),
  isSuiteSpecific,
  nonRecursiveTestSuiteIdList,
  includeAttachments,
  attachmentType,
  includeHardCopyRun: isStpMode ? false : includeHardCopyRun,
  includeAttachmentContent,
  includeRequirements,
  includeCustomerId,
  traceAnalysisRequest,
  linkedMomRequest,
});
