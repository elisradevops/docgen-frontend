import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { Button, FormLabel, Box, Radio, RadioGroup, Collapse, Typography, Grid, Stack, Divider } from '@mui/material';
import { toJS } from 'mobx';
import DetailedStepsSettingsDialog from '../../dialogs/DetailedStepsSettingsDialog';
import { observer } from 'mobx-react';
import { validateQuery } from '../../../utils/queryValidation';
import { toast } from 'react-toastify';
import OpenPcrDialog from '../../dialogs/OpenPcrDialog';
import SettingsDisplay from '../SettingsDisplay';
import SmartAutocomplete from '../SmartAutocomplete';
import SectionCard from '../../layout/SectionCard';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import { suiteIdCollection } from '../../../utils/sessionPersistence';
import RestoreBackdrop from '../RestoreBackdrop';

/**
 * STRTableSelector
 * Manages STR test plan/suites, options, and detailed steps with session/favorite restore.
 */

const initialStepsExecutionState = {
  isEnabled: false,
  generateAttachments: {
    isEnabled: false,
    attachmentType: 'asEmbedded',
    includeAttachmentContent: false,
    runAttachmentMode: 'both',
  },
  generateRequirements: {
    isEnabled: false,
    includeCustomerId: false,
    requirementInclusionMode: 'linkedRequirement',
    testReqQuery: null,
    flatSuiteTestCases: false,
  },
};

const initialStepsAnalysisState = {
  isEnabled: false,
  generateRunAttachments: {
    isEnabled: false,
    attachmentType: 'asEmbedded',
    includeAttachmentContent: false,
  },
  isGenerateLinkPCRSEnabled: false,
};

const defaultSelectedQueries = {
  openPcrMode: 'none',
  testToOpenPcrQuery: null,
  OpenPcrToTestQuery: null,
  includeCommonColumnsMode: 'both',
};

const STRTableSelector = observer(
  ({
    store,
    contentControlTitle,
    type,
    skin,
    addToDocumentRequestObject,
    editingMode,
    contentControlIndex,
  }) => {
    const [selectedTestPlan, setSelectedTestPlan] = useState({
      key: '',
      text: '',
    });

    const [queryTrees, setQueryTrees] = useState({
      testReqTree: [],
    });
    const [selectedTestSuites, setSelectedTestSuites] = useState([]);
    const [isSuiteSpecific, setIsSuiteSpecific] = useState(false);
    const [includeConfigurations, setIncludeConfigurations] = useState(false);
    const [includeHierarchy, setIncludeHierarchy] = useState(false);
    // const [includeOpenPCRs, setIncludeOpenPCRs] = useState(false);
    const [openPCRsSelectionRequest, setOpenPCRsSelectionRequest] = useState(
      defaultSelectedQueries
    );

    // Re-apply query-dependent parts once shared queries are available (handles late arrivals)
    useEffect(() => {
      if (!savedDataRef.current) return;
      if (!store?.sharedQueries?.acquiredTrees) return;
      try {
        processOpenPcrRequest(savedDataRef.current.openPCRsSelectionRequest);
        processRequirementQueries(savedDataRef.current);
      } catch {
        /* empty */
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.sharedQueries]);
    // const [openPCRsSelection, setOpenPCRsSelection] = useState('linked');
    const [includeTestLog, setIncludeTestLog] = useState(false);
    const [includeHardCopyRun, setIncludeHardCopyRun] = useState(false);
    const [flatSuiteTestCases, setFlatSuiteTestCases] = useState(false);

    const [stepExecutionState, setStepExecutionState] = useState(
      initialStepsExecutionState
    );
    const [stepAnalysisState, setStepAnalysisState] = useState(
      initialStepsAnalysisState
    );

    const savedDataRef = React.useRef(null);

    // Keep the last loaded data so we can re-apply query-dependent parts when shared queries arrive
    // (Value is set inside applySavedData provided to the hook)

    const UpdateDocumentRequestObject = useCallback(() => {
      if (!store?.docType) return; // wait until docType is set to avoid writing under a wrong/empty key
      let testSuiteIdList = undefined;
      let nonRecursiveTestSuiteIdList = undefined;
      if (isSuiteSpecific) {
        const { testSuiteArray, nonRecursiveTestSuiteIdList: nonRec } = suiteIdCollection(selectedTestSuites, store);
        testSuiteIdList = testSuiteArray;
        nonRecursiveTestSuiteIdList = nonRec;
      }
      addToDocumentRequestObject(
        {
          type: type,
          title: contentControlTitle,
          skin: skin,
          headingLevel: 1,
          data: {
            testPlanId: selectedTestPlan.key,
            testPlanText: selectedTestPlan.text || '',
            testSuiteArray: testSuiteIdList,
            testSuiteTextList: Array.isArray(selectedTestSuites)
              ? selectedTestSuites
                  .map((s) => s?.text || s?.name || String(s?.id ?? s?.key ?? ''))
                  .filter(Boolean)
              : [],
            isSuiteSpecific,
            nonRecursiveTestSuiteIdList: nonRecursiveTestSuiteIdList,
            includeConfigurations: includeConfigurations,
            includeHierarchy: includeHierarchy,
            openPCRsSelectionRequest: openPCRsSelectionRequest,
            // includeOpenPCRs: includeOpenPCRs,
            // openPCRsSelection: openPCRsSelection,
            includeTestLog: includeTestLog,
            stepExecution: stepExecutionState,
            stepAnalysis: stepAnalysisState,
            includeHardCopyRun: includeHardCopyRun,
            flatSuiteTestCases,
          },
        },
        contentControlIndex
      );
    }, [
      isSuiteSpecific,
      selectedTestSuites,
      addToDocumentRequestObject,
      type,
      contentControlTitle,
      skin,
      selectedTestPlan.key,
      includeConfigurations,
      includeHierarchy,
      openPCRsSelectionRequest,
      includeTestLog,
      stepExecutionState,
      stepAnalysisState,
      includeHardCopyRun,
      flatSuiteTestCases,
      contentControlIndex,
      store,
      selectedTestPlan.text,
    ]);

    

    // Validation: test plan required; if suite-specific, require at least one suite
    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!selectedTestPlan?.key) {
        isValid = false;
        message = 'Select a test plan';
      } else if (
        isSuiteSpecific &&
        (!Array.isArray(selectedTestSuites) || selectedTestSuites.length === 0)
      ) {
        isValid = false;
        message =
          'Select at least one suite or disable suite-specific selection';
      }
      try {
        store.setValidationState(contentControlIndex, 'strTable', {
          isValid,
          message,
        });
        // Clear any pre-seeded init invalid flag for this control
        store.clearValidationForIndex(contentControlIndex, 'init');
      } catch {
        /* empty */
      }
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'strTable');
        } catch {
          /* empty */
        }
      };
    }, [
      selectedTestPlan?.key,
      isSuiteSpecific,
      selectedTestSuites,
      store,
      contentControlIndex,
    ]);
    // }, [editingMode]);

    useEffect(() => {
      if (!store.sharedQueries) return;
      const { acquiredTrees } = toJS(store.sharedQueries);
      acquiredTrees !== null
        ? setQueryTrees(() => ({
            testReqTree: acquiredTrees.reqTestTrees?.testReqTree
              ? [acquiredTrees.reqTestTrees?.testReqTree]
              : [],
          }))
        : setQueryTrees({ testReqTree: [] });
    }, [store.sharedQueries, store.sharedQueries.acquiredTrees]);

    // Clear local suite selections when no test plan is selected to avoid showing stale suites across tabs
    useEffect(() => {
      if (!selectedTestPlan?.key) {
        setSelectedTestSuites([]);
      }
    }, [selectedTestPlan?.key]);

    // Map suite id -> suite for readable grouping in the suites autocomplete
    const suiteById = useMemo(() => {
      const map = new Map();
      (store.testSuiteList || []).forEach((s) => map.set(s.id, s));
      return map;
    }, [store.testSuiteList]);

    //For detailed steps execution
    useEffect(() => {
      if (!stepExecutionState?.isEnabled) {
        setStepExecutionState(initialStepsExecutionState);
      }
    }, [stepExecutionState.isEnabled]);

    //For detailed steps analysis
    useEffect(() => {
      if (!stepAnalysisState.isEnabled) {
        setStepAnalysisState(initialStepsAnalysisState);
      }
    }, [stepAnalysisState.isEnabled]);

    const processGeneralSettings = useCallback((dataToSave) => {
      setIncludeConfigurations(dataToSave.includeConfigurations);
      setIncludeHierarchy(dataToSave.includeHierarchy);
      setIncludeTestLog(dataToSave.includeTestLog);
      setIncludeHardCopyRun(dataToSave.includeHardCopyRun);
      setFlatSuiteTestCases(!!dataToSave.flatSuiteTestCases);
    }, []);

    const processTestSuiteSelections = useCallback(
      (dataToSave) => {
        const testSuiteList = store.getTestSuiteList;
        if (dataToSave?.nonRecursiveTestSuiteIdList?.length > 0) {
          const validTestSuites = dataToSave.nonRecursiveTestSuiteIdList
            .map((suiteId) =>
              testSuiteList.find((suite) => suite.id === suiteId)
            )
            .filter(Boolean)
            .map((s) => ({ ...s, key: s.id, text: `${s.name} - (${s.id})` }));

          if (validTestSuites.length > 0) {
            setIsSuiteSpecific(true);
            setSelectedTestSuites(validTestSuites);
          }
        } else {
          setIsSuiteSpecific(false);
          setSelectedTestSuites([]);
        }
      },
      [store.getTestSuiteList]
    );

    // Validate and process trace analysis request
    const processOpenPcrRequest = useCallback(
      (openPCRsSelectionRequest) => {
        if (!openPCRsSelectionRequest || !store.sharedQueries) return;

        const validatedRequest = { ...openPCRsSelectionRequest };
        if (
          openPCRsSelectionRequest.testToOpenPcrQuery &&
          store.sharedQueries?.acquiredTrees?.TestToOpenPcrTree
        ) {
          const validTestOpenPcrQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.TestToOpenPcrTree],
            openPCRsSelectionRequest.testToOpenPcrQuery
          );

          if (
            !validTestOpenPcrQuery &&
            openPCRsSelectionRequest.testToOpenPcrQuery
          ) {
            toast.warn(
              `Previously selected Test - Open PCR query "${openPCRsSelectionRequest.testToOpenPcrQuery.title}" not found or invalid`
            );
          }
          validatedRequest.testToOpenPcrQuery = validTestOpenPcrQuery;
        }

        if (
          openPCRsSelectionRequest.OpenPcrToTestQuery &&
          store.sharedQueries?.acquiredTrees?.OpenPcrToTestTree
        ) {
          const validOpenPCRTestQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.OpenPcrToTestTree],
            openPCRsSelectionRequest.OpenPcrToTestQuery
          );

          if (
            !validOpenPCRTestQuery &&
            openPCRsSelectionRequest.OpenPcrToTestQuery
          ) {
            toast.warn(
              `Previously selected Open PCR - Test query "${openPCRsSelectionRequest.OpenPcrToTestQuery.title}" not found or invalid`
            );
          }
          validatedRequest.OpenPcrToTestQuery = validOpenPCRTestQuery;
        }

        setOpenPCRsSelectionRequest(validatedRequest);
      },
      [store.sharedQueries]
    );

    const processRequirementQueries = useCallback(
      (dataToSave) => {
        const testReqQuery =
          dataToSave.stepExecution?.generateRequirements?.testReqQuery;
        if (
          testReqQuery &&
          store.sharedQueries?.acquiredTrees?.reqTestTrees?.testReqTree
        ) {
          const validTestReqQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.reqTestTrees.testReqTree],
            testReqQuery
          );

          if (!validTestReqQuery) {
            toast.warn(
              `Previously selected Test-Requirement query "${testReqQuery.title}" not found or invalid`
            );
          }

          dataToSave.stepExecution.generateRequirements.testReqQuery =
            validTestReqQuery;
        }
      },
      [store.sharedQueries?.acquiredTrees?.reqTestTrees?.testReqTree]
    );

    const waitForSuitesToLoad = useCallback(async () => {
      const deadline = Date.now() + 10000;
      while (store.loadingState?.testSuiteListLoading) {
        if (Date.now() > deadline) break;
        await new Promise((r) => setTimeout(r, 50));
      }
    }, [store.loadingState?.testSuiteListLoading]);

    const handleTestPlanChanged = useCallback(
      async (value) => {
        store.fetchTestSuitesList(value.key);
        await waitForSuitesToLoad();
        setSelectedTestSuites([]);
        if (value.text) {
          let testPlanNameForFile = value.text
            .trim()
            .replace(/\./g, '-')
            .replace(/\s+/g, '_');
          store.setContextName(testPlanNameForFile);
        }
        setSelectedTestPlan(value);
      },
      [store, waitForSuitesToLoad]
    );

    const processTestPlanSelection = useCallback(
      async (dataToSave) => {
        const testPlanId = dataToSave?.testPlanId;
        if (!testPlanId) return;
        const testPlan = store.testPlansList.find((tp) => tp.id === testPlanId);
        if (!testPlan) {
          toast.warn(`Test plan with ID ${testPlanId} not found`);
          return;
        }
        await handleTestPlanChanged({ key: testPlanId, text: testPlan.name });
      },
      [store.testPlansList, handleTestPlanChanged]
    );

    const applySavedData = useCallback(
      async (dataToSave) => {
        try {
          await processTestPlanSelection(dataToSave);
          processGeneralSettings(dataToSave);
          processOpenPcrRequest(dataToSave.openPCRsSelectionRequest);
          await processTestSuiteSelections(dataToSave);
          processRequirementQueries(dataToSave);
          setStepExecutionState(dataToSave.stepExecution);
          setStepAnalysisState(dataToSave.stepAnalysis);
          savedDataRef.current = dataToSave;
        } catch (error) {
          console.error('Error loading saved data:', error);
          toast.error(`Error loading saved data: ${error.message}`);
        }
      },
      [
        processGeneralSettings,
        processOpenPcrRequest,
        processRequirementQueries,
        processTestPlanSelection,
        processTestSuiteSelections,
      ]
    );

    const resetLocalState = useCallback(() => {
      setSelectedTestPlan({ key: '', text: '' });
      setSelectedTestSuites([]);
      setIsSuiteSpecific(false);
      setIncludeConfigurations(false);
      setIncludeHierarchy(false);
      setIncludeTestLog(false);
      setIncludeHardCopyRun(false);
      setFlatSuiteTestCases(false);
      setStepExecutionState(initialStepsExecutionState);
      setStepAnalysisState(initialStepsAnalysisState);
      setOpenPCRsSelectionRequest(defaultSelectedQueries);
      savedDataRef.current = null;
    }, []);

    const { isRestoring, restoreReady } = useTabStatePersistence({
      store,
      contentControlIndex,
      applySavedData,
      resetLocalState,
    });

    // Favorite and Session restore handled by useTabStatePersistence

    // Save on state changes, but only after restore completes
    useEffect(() => {
      if (editingMode === false && !isRestoring && restoreReady) {
        UpdateDocumentRequestObject();
      }
    }, [
      selectedTestPlan,
      selectedTestSuites,
      includeConfigurations,
      includeHierarchy,
      includeTestLog,
      includeHardCopyRun,
      stepExecutionState,
      stepAnalysisState,
      openPCRsSelectionRequest,
      editingMode,
      UpdateDocumentRequestObject,
      isRestoring,
      restoreReady,
    ]);

    // Persist restored state once restoration completes (captures values changed only during restore)
    useEffect(() => {
      if (editingMode === false && !isRestoring && restoreReady) {
        UpdateDocumentRequestObject();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRestoring, restoreReady]);

    const generateIncludedOpenPcrSettings = () => {
      const settings = [];

      if (openPCRsSelectionRequest.includeCommonColumnsMode !== 'both') {
        settings.push(
          `Include Common Columns for ${
            openPCRsSelectionRequest.includeCommonColumnsMode !== 'openPcrOnly'
              ? 'Test Case Only'
              : 'Open PCR Only'
          }`
        );
      }
      if (openPCRsSelectionRequest.openPcrMode !== 'none') {
        const traceMode =
          openPCRsSelectionRequest.openPcrMode === 'query'
            ? 'from Query'
            : 'from Linked Open Items';
        settings.push(`Open PCRs ${traceMode}`);

        if (openPCRsSelectionRequest.openPcrMode === 'query') {
          if (openPCRsSelectionRequest.testToOpenPcrQuery?.value) {
            settings.push(
              `Test to Open PCR Query: ${openPCRsSelectionRequest.testToOpenPcrQuery.value}`
            );
          }
          if (openPCRsSelectionRequest.OpenPcrToTestQuery?.value) {
            settings.push(
              `Open PCR To Test Query: ${openPCRsSelectionRequest.OpenPcrToTestQuery.value}`
            );
          }
        }
      }

      return settings;
    };

    const attachmentTypeElements = (attachmentProp) => {
      const getRadioGroup = (name, value, onChange) => (
        <RadioGroup
          name={name}
          value={value ?? 'asEmbedded'} // Default to 'asEmbedded' if value is null or undefined
          onChange={onChange}
        >
          <FormControlLabel
            value='asEmbedded'
            label='As Embedded'
            control={<Radio />}
          />
          <FormControlLabel
            value='asLink'
            label='As Link'
            control={<Radio />}
          />
        </RadioGroup>
      );

      const handleChange = (event, setState, key) => {
        const newAttachmentType = event.target.value || 'asEmbedded'; // Fallback to 'asEmbedded' if empty
        setState((prevState) => ({
          ...prevState,
          [key]: {
            ...prevState[key],
            attachmentType: newAttachmentType,
          },
        }));
      };

      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
          <div>
            <FormLabel id={`include-office-${attachmentProp}-attachment-radio`}>
              Included Office Files Type
            </FormLabel>
            {attachmentProp === 'analysis' &&
              getRadioGroup(
                `include-office-analysis-attachment-radio`,
                stepAnalysisState?.generateRunAttachments?.attachmentType,
                (event) =>
                  handleChange(
                    event,
                    setStepAnalysisState,
                    'generateRunAttachments'
                  )
              )}
          </div>
          <div>
            <FormControlLabel
              checked={
                stepAnalysisState.generateRunAttachments
                  .includeAttachmentContent
              }
              control={<Checkbox />}
              onChange={(event, checked) => {
                setStepAnalysisState((prev) => ({
                  ...prev,
                  generateRunAttachments: {
                    ...prev.generateRunAttachments,
                    includeAttachmentContent: checked,
                  },
                }));
              }}
              label='Include Attachment Content'
            />
          </div>
        </Box>
      );
    };

    const detailedStepsAnalysisElements = (
      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
        <div>
          <FormControlLabel
            label='Generate Run Attachments'
            control={
              <Checkbox
                checked={stepAnalysisState.generateRunAttachments.isEnabled}
                onChange={(event, checked) =>
                  setStepAnalysisState((prev) => ({
                    ...prev,
                    generateRunAttachments: {
                      ...prev.generateRunAttachments,
                      isEnabled: checked,
                    },
                  }))
                }
              />
            }
          />
          {stepAnalysisState.generateRunAttachments.isEnabled &&
            attachmentTypeElements('analysis')}
        </div>
      </Box>
    );

    const generateIncludedStepExecutionSettings = () => {
      const settings = [];

      if (stepExecutionState.isEnabled) {
        if (stepExecutionState.generateAttachments.isEnabled) {
          settings.push(
            `Attachments as ${
              stepExecutionState.generateAttachments.attachmentType ===
              'asEmbedded'
                ? 'Embedded'
                : 'Link'
            }`
          );
          if (
            stepExecutionState.generateAttachments.runAttachmentMode !== 'both'
          ) {
            settings.push(
              `Evidence Attachment by ${
                stepExecutionState.generateAttachments.runAttachmentMode ===
                'runOnly'
                  ? 'Run Only'
                  : 'Plan Only'
              }`
            );
          }
          if (stepExecutionState.generateAttachments.includeAttachmentContent) {
            settings.push('Include Attachment Content');
          }
        }

        if (stepExecutionState.generateRequirements.isEnabled) {
          const reqMode =
            stepExecutionState.generateRequirements.requirementInclusionMode ===
            'query'
              ? 'from Query'
              : 'from Linked Requirements';
          const customerId = stepExecutionState.generateRequirements
            .includeCustomerId
            ? ' with Customer ID'
            : '';
          settings.push(`Requirements ${reqMode}${customerId}`);
          if (stepExecutionState.generateRequirements.testReqQuery?.value) {
            settings.push(
              `Selected Query: ${stepExecutionState.generateRequirements.testReqQuery.value}`
            );
          }
        }
      }

      return settings;
    };

    const generateIncludedStepAnalysisSettings = () => {
      const settings = [];
      if (!stepAnalysisState.isEnabled) return settings;

      if (stepAnalysisState.generateRunAttachments?.isEnabled) {
        const type =
          stepAnalysisState.generateRunAttachments.attachmentType === 'asEmbedded'
            ? 'Embedded'
            : 'Link';
        settings.push(`Attachments as ${type}`);
        if (stepAnalysisState.generateRunAttachments.includeAttachmentContent) {
          settings.push('Include attachment content');
        }
      }

      if (stepAnalysisState.isGenerateLinkPCRSEnabled) {
        settings.push('Include linked PCRs');
      }

      return settings;
    };

    const openPcrSummary = generateIncludedOpenPcrSettings();
    const stepExecutionSummary = generateIncludedStepExecutionSettings();
    const stepAnalysisSummary = generateIncludedStepAnalysisSettings();

    return (
      <>
      <Stack spacing={1.5}>
        <SectionCard
          title='Test Plan and Suites'
          description='Choose the plan that drives this STR and optionally target specific suites.'
        >
          <Stack spacing={1.25}>
            <SmartAutocomplete
              disableClearable
              autoHighlight
              openOnFocus
              loading={store.loadingState.testPlanLoadingState}
              options={store.testPlansList.map((t) => ({ key: t.id, text: t.name }))}
              label='Test Plan'
              value={selectedTestPlan}
              onChange={async (_event, value) => {
                if (!value) {
                  setSelectedTestPlan({ key: '', text: '' });
                  setSelectedTestSuites([]);
                  return;
                }
                await handleTestPlanChanged(value);
              }}
            />
            <Stack spacing={0.75}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isSuiteSpecific}
                    onChange={(_event, checked) => setIsSuiteSpecific(checked)}
                  />
                }
                label='Limit to specific suites'
              />
              {isSuiteSpecific ? (
                <SmartAutocomplete
                  multiple
                  disableCloseOnSelect
                  autoHighlight
                  openOnFocus
                  showCheckbox
                  options={
                    selectedTestPlan?.key
                      ? (store.testSuiteList || []).map((suite) => ({
                          ...suite,
                          key: suite.id,
                          id: suite.id,
                          text: `${suite.name} - (${suite.id})`,
                        }))
                      : []
                  }
                  groupBy={(option) => {
                    const parent = suiteById.get(option.parent);
                    return parent ? `Parent: ${parent.name}` : 'Top Level';
                  }}
                  loading={store.loadingState.testSuiteListLoading}
                  label='Suites'
                  textFieldProps={{
                    helperText: selectedTestPlan?.key
                      ? 'Descendants are automatically included'
                      : 'Select a test plan first',
                  }}
                  value={selectedTestSuites}
                  onChange={(_event, newValue) => setSelectedTestSuites(newValue || [])}
                />
              ) : null}
            </Stack>
            <Divider flexItem />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems='flex-start'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeHardCopyRun}
                    onChange={(_event, checked) => setIncludeHardCopyRun(checked)}
                  />
                }
                label='Generate manual hard-copy run'
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={flatSuiteTestCases}
                    onChange={(_event, checked) => setFlatSuiteTestCases(checked)}
                  />
                }
                label='Flatten single-suite test cases'
              />
            </Stack>
          </Stack>
        </SectionCard>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.5}>
              <SectionCard title='Options' compact>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeConfigurations}
                        onChange={(_event, checked) => setIncludeConfigurations(checked)}
                      />
                    }
                    label='Display configuration name'
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeHierarchy}
                        onChange={(_event, checked) => setIncludeHierarchy(checked)}
                      />
                    }
                    label='Display test group hierarchy'
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeTestLog}
                        onChange={(_event, checked) => setIncludeTestLog(checked)}
                      />
                    }
                    label='Include test log'
                  />
                </Stack>
              </SectionCard>

              <SectionCard
                title='Open PCR'
                compact
                description='Control inclusion of related PCR items.'
                actions={
                  <OpenPcrDialog
                    store={store}
                    sharedQueries={store.sharedQueries}
                    prevOpenPcrRequest={openPCRsSelectionRequest}
                    onOpenPcrChange={setOpenPCRsSelectionRequest}
                  />
                }
              >
                <SettingsDisplay
                  title='Configured values'
                  settings={openPcrSummary}
                  emptyMessage='No open PCR settings enabled.'
                  boxProps={{ p: 0, bgcolor: 'transparent' }}
                />
              </SectionCard>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.5}>
              <SectionCard
                title='Detailed Steps Execution'
                compact
                enableToggle='Enable'
                enabled={stepExecutionState.isEnabled}
                onToggle={(_event, checked) =>
                  setStepExecutionState((prev) => ({ ...prev, isEnabled: checked }))
                }
                actions={
                  stepExecutionState.isEnabled ? (
                    <DetailedStepsSettingsDialog
                      store={store}
                      queryTrees={queryTrees}
                      prevStepExecution={stepExecutionState}
                      onStepExecutionStateChange={setStepExecutionState}
                    />
                  ) : null
                }
              >
                {stepExecutionState.isEnabled ? (
                  <SettingsDisplay
                    title='Execution settings'
                    settings={stepExecutionSummary}
                    emptyMessage='No detailed steps execution settings enabled.'
                    boxProps={{ p: 0, bgcolor: 'transparent' }}
                  />
                ) : (
                  <Typography variant='body2' color='text.secondary'>
                    Enable detailed steps execution to configure additional evidence and requirement options.
                  </Typography>
                )}
              </SectionCard>

              <SectionCard
                title='Detailed Steps Analysis'
                compact
                enableToggle='Enable'
                enabled={stepAnalysisState.isEnabled}
                onToggle={(_event, checked) =>
                  setStepAnalysisState((prev) => ({ ...prev, isEnabled: checked }))
                }
              >
                {stepAnalysisState.isEnabled ? (
                  <Stack spacing={1}>
                    <SettingsDisplay
                      title='Analysis settings'
                      settings={stepAnalysisSummary}
                      emptyMessage='No detailed steps analysis settings enabled.'
                      boxProps={{ p: 0, bgcolor: 'transparent' }}
                    />
                    {detailedStepsAnalysisElements}
                  </Stack>
                ) : (
                  <Typography variant='body2' color='text.secondary'>
                    Enable detailed steps analysis to configure run attachments and additional trace options.
                  </Typography>
                )}
              </SectionCard>
            </Stack>
          </Grid>
        </Grid>

        {editingMode ? (
          <Box sx={{ textAlign: 'right' }}>
            <Button
              disabled={isSuiteSpecific && selectedTestSuites.length === 0}
              variant='contained'
              onClick={UpdateDocumentRequestObject}
            >
              Add Content To Document
            </Button>
          </Box>
        ) : null}
      </Stack>
      <RestoreBackdrop open={!!isRestoring} label='Restoring STR selection…' />
      </>
    );
  }
);
export default STRTableSelector;
