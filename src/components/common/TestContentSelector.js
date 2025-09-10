import React, { useState, useEffect, useCallback } from 'react';
// import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { PrimaryButton } from '@fluentui/react';
import { Box, Radio, RadioGroup, FormLabel, Grid } from '@mui/material';

import TraceAnalysisDialog from '../dialogs/TraceAnalysisDialog';
import { observer } from 'mobx-react';
import { validateQuery } from '../../utils/queryValidation';
import { toast } from 'react-toastify';
import LinkedMomDialog from '../dialogs/LinkedMomDialog';
import SettingsDisplay from './SettingsDisplay'; // Import the new SettingsDisplay component
import SmartAutocomplete from './SmartAutocomplete';

const defaultSelectedQueries = {
  traceAnalysisMode: 'none',
  reqTestQuery: null,
  testReqQuery: null,
  includeCommonColumnsMode: 'both',
};

const defaultLinkedMomRequest = {
  linkedMomMode: 'none',
  linkedMomQuery: null,
};

const TestContentSelector = observer(
  ({
    store,
    contentControlTitle,
    type,
    skin,
    editingMode,
    addToDocumentRequestObject,
    linkTypeFilterArray,
    contentControlIndex,
  }) => {
    const [selectedTestPlan, setSelectedTestPlan] = useState({
      key: '',
      text: '',
    });
    const [selectedTestSuites, setSelectedTestSuites] = useState([]);
    const [includeHardCopyRun, setIncludeHardCopyRun] = useState(false);
    const [includeAttachments, setIncludeAttachments] = useState(false);
    const [attachmentType, setAttachmentType] = useState('asEmbedded');
    const [includeAttachmentContent, setIncludeAttachmentContent] = useState(false);
    const [isSuiteSpecific, setIsSuiteSpecific] = useState(false);
    const [contentHeadingLevel, setContentHeadingLevel] = useState(1);
    const [includeRequirements, setIncludeRequirements] = useState(false);
    const [linkedMomRequest, setLinkedMomRequest] = useState(defaultLinkedMomRequest);
    const [includeCustomerId, setIncludeCustomerId] = useState(false);
    const [traceAnalysisRequest, setTraceAnalysisRequest] = useState(defaultSelectedQueries);
    const [flatSuiteTestCases, setFlatSuiteTestCases] = useState(false);

    const UpdateDocumentRequestObject = useCallback(() => {
      let testSuiteIdList = undefined;
      let nonRecursiveTestSuiteIdList = undefined;
      if (isSuiteSpecific) {
        testSuiteIdList = []; // Initialize only if the checkbox is checked
        nonRecursiveTestSuiteIdList = [];
        // Function to recursively add children suites
        const addChildrenSuites = (suiteId) => {
          const suite = store.testSuiteList?.find((suite) => suite.id === suiteId);
          if (suite && !testSuiteIdList.includes(suiteId)) {
            testSuiteIdList.push(suiteId);
            const children = store.testSuiteList?.filter((child) => child.parent === suiteId);
            children.forEach((child) => {
              addChildrenSuites(child.id);
            });
          }
        };

        // Add suites selected and their children
        selectedTestSuites.forEach((suite) => {
          nonRecursiveTestSuiteIdList.push(suite.id);
          addChildrenSuites(suite.id);
        });
      }
      addToDocumentRequestObject(
        {
          type: type,
          title: contentControlTitle,
          skin: skin,
          headingLevel: contentHeadingLevel,
          data: {
            testPlanId: selectedTestPlan.key,
            testSuiteArray: testSuiteIdList,
            nonRecursiveTestSuiteIdList: nonRecursiveTestSuiteIdList,
            includeAttachments: includeAttachments,
            attachmentType: attachmentType,
            includeHardCopyRun: includeHardCopyRun,
            includeAttachmentContent: includeAttachmentContent,
            includeRequirements: includeRequirements,
            includeCustomerId: includeCustomerId,
            traceAnalysisRequest: traceAnalysisRequest,
            linkedMomRequest: linkedMomRequest,
            flatSuiteTestCases: flatSuiteTestCases,
          },
        },
        contentControlIndex
      );
    }, [
      isSuiteSpecific,
      addToDocumentRequestObject,
      type,
      contentControlTitle,
      skin,
      contentHeadingLevel,
      selectedTestPlan.key,
      includeAttachments,
      attachmentType,
      includeHardCopyRun,
      includeAttachmentContent,
      includeRequirements,
      linkedMomRequest,
      includeCustomerId,
      traceAnalysisRequest,
      flatSuiteTestCases,
      contentControlIndex,
      selectedTestSuites,
      store.testSuiteList,
    ]);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [
      selectedTestPlan,
      isSuiteSpecific,
      selectedTestSuites,
      includeHardCopyRun,
      includeAttachments,
      attachmentType,
      includeAttachmentContent,
      includeRequirements,
      includeCustomerId,
      traceAnalysisRequest,
      editingMode,
      flatSuiteTestCases,
      UpdateDocumentRequestObject,
    ]);

    // Validation: test plan required; if suite-specific, require at least one suite
    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!selectedTestPlan?.key) {
        isValid = false;
        message = 'Select a test plan';
      } else if (isSuiteSpecific && (!Array.isArray(selectedTestSuites) || selectedTestSuites.length === 0)) {
        isValid = false;
        message = 'Select at least one suite or disable suite-specific selection';
      }
      try {
        store.setValidationState(contentControlIndex, 'testContent', { isValid, message });
        // Clear any pre-seeded init invalid flag for this control
        store.clearValidationForIndex(contentControlIndex, 'init');
      } catch {}
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'testContent');
        } catch {}
      };
    }, [selectedTestPlan?.key, isSuiteSpecific, selectedTestSuites, store, contentControlIndex]);

    const handleTestPlanChanged = useCallback(
      async (value) => {
        await store.fetchTestSuitesList(value.key);
        setSelectedTestSuites([]);
        if (value.text) {
          let testPlanNameForFile = value.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
          store.setContextName(testPlanNameForFile);
        }
        setSelectedTestPlan(value || { key: '', text: '' });
      },
      [store]
    );

    // Process test plan selection
    const processTestPlanSelection = useCallback(
      async (dataToSave) => {
        const { testPlanId } = dataToSave;
        const testPlan = store.testPlansList.find((testplan) => testplan.id === testPlanId);

        if (!testPlan) {
          toast.warn(`Test plan with ID ${testPlanId} not found`);
          return;
        }

        await handleTestPlanChanged({ key: testPlanId, text: testPlan.name });
      },
      [store.testPlansList, handleTestPlanChanged]
    );

    // Process general settings
    const processGeneralSettings = useCallback((dataToSave) => {
      const {
        includeAttachments,
        attachmentType,
        includeHardCopyRun,
        includeAttachmentContent,
        includeRequirements,
        includeCustomerId,
        flatSuiteTestCases,
      } = dataToSave;

      setIncludeAttachments(includeAttachments);
      setAttachmentType(attachmentType);
      setIncludeHardCopyRun(includeHardCopyRun);
      setIncludeAttachmentContent(includeAttachmentContent);
      setIncludeRequirements(includeRequirements);
      setIncludeCustomerId(includeCustomerId);
      setFlatSuiteTestCases(flatSuiteTestCases);
    }, []);

    // Validate and process trace analysis request
    const processTraceAnalysisRequest = useCallback(
      (traceAnalysisRequest) => {
        if (!traceAnalysisRequest || !store.sharedQueries) return;

        const validatedRequest = { ...traceAnalysisRequest };

        if (traceAnalysisRequest.reqTestQuery && store.sharedQueries?.acquiredTrees?.reqTestTree) {
          const validReqTestQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.reqTestTree],
            traceAnalysisRequest.reqTestQuery
          );

          if (!validReqTestQuery && traceAnalysisRequest.reqTestQuery) {
            toast.warn(
              `Previously selected Req-Test query "${traceAnalysisRequest.reqTestQuery.title}" not found or invalid`
            );
          }
          validatedRequest.reqTestQuery = validReqTestQuery;
        }

        if (traceAnalysisRequest.testReqQuery && store.sharedQueries?.acquiredTrees?.testReqTree) {
          const validTestReqQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.testReqTree],
            traceAnalysisRequest.testReqQuery
          );

          if (!validTestReqQuery && traceAnalysisRequest.testReqQuery) {
            toast.warn(
              `Previously selected Test-Req query "${traceAnalysisRequest.testReqQuery.title}" not found or invalid`
            );
          }
          validatedRequest.testReqQuery = validTestReqQuery;
        }

        setTraceAnalysisRequest(validatedRequest);
      },
      [store.sharedQueries]
    );

    const processLinkedMomRequest = useCallback(
      (linkedMomRequest) => {
        if (!linkedMomRequest || !store.sharedQueries) return;

        const validatedRequest = { ...linkedMomRequest };

        if (linkedMomRequest.linkedMomQuery && store.sharedQueries?.acquiredTrees?.linkedMomTree) {
          const validLinkedMomQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.linkedMomTree],
            linkedMomRequest.linkedMomQuery
          );

          if (!validLinkedMomQuery && linkedMomRequest.linkedMomQuery) {
            toast.warn(
              `Previously selected Linked MOM query "${linkedMomRequest.linkedMomQuery.title}" not found or invalid`
            );
          }
          validatedRequest.linkedMomQuery = validLinkedMomQuery;
        }

        setLinkedMomRequest(validatedRequest);
      },
      [store.sharedQueries]
    );

    // Process test suite selections
    const processTestSuiteSelections = useCallback(
      (dataToSave) => {
        const { nonRecursiveTestSuiteIdList } = dataToSave;
        const testSuiteList = store.getTestSuiteList;

        if (nonRecursiveTestSuiteIdList?.length > 0) {
          const validTestSuites = nonRecursiveTestSuiteIdList
            .map((suiteId) => testSuiteList.find((suite) => suite.id === suiteId))
            .filter(Boolean);

          if (validTestSuites.length > 0) {
            setIsSuiteSpecific(true);
            setSelectedTestSuites(validTestSuites);
          }
        }
      },
      [store.getTestSuiteList]
    );

    // Move async logic outside the effect
    const loadSavedData = useCallback(
      async (dataToSave) => {
        try {
          await processTestPlanSelection(dataToSave);
          processGeneralSettings(dataToSave);
          processTraceAnalysisRequest(dataToSave.traceAnalysisRequest);
          processLinkedMomRequest(dataToSave.linkedMomRequest);
          processTestSuiteSelections(dataToSave);
        } catch (error) {
          console.error('Error loading saved data:', error);
          toast.error(`Error loading favorite data: ${error.message}`);
        }
      },
      [
        processGeneralSettings,
        processTestPlanSelection,
        processTestSuiteSelections,
        processTraceAnalysisRequest,
        processLinkedMomRequest,
      ]
    );

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (store.selectedFavorite?.dataToSave) {
        loadSavedData(store.selectedFavorite.dataToSave);
      }
    }, [loadSavedData, store.selectedFavorite]);

    // Clear local suite selections when no test plan is selected to avoid showing stale suites across tabs
    useEffect(() => {
      if (!selectedTestPlan?.key) {
        setSelectedTestSuites([]);
      }
    }, [selectedTestPlan?.key]);

    const generateIncludedSettings = () => {
      const linkedMomSettings = [];
      const traceAnalysisSettings = [];

      // Linked MOM Settings
      if (linkedMomRequest.linkedMomMode !== 'none') {
        linkedMomSettings.push(`Linked MOM Mode: ${linkedMomRequest.linkedMomMode}`);
      }
      if (linkedMomRequest.linkedMomQuery?.value) {
        linkedMomSettings.push(`Linked MOM Query: ${linkedMomRequest.linkedMomQuery.value}`);
      }

      // Trace Analysis Settings
      if (traceAnalysisRequest.includeCommonColumnsMode !== 'both') {
        traceAnalysisSettings.push(
          `Include Common Columns for ${
            traceAnalysisRequest.includeCommonColumnsMode !== 'reqOnly'
              ? 'Test Case Only'
              : 'Requirement Only'
          }`
        );
      }
      if (traceAnalysisRequest.traceAnalysisMode !== 'none') {
        const traceMode =
          traceAnalysisRequest.traceAnalysisMode === 'query' ? 'from Query' : 'from Linked Requirements';
        traceAnalysisSettings.push(`Requirements ${traceMode}`);

        if (traceAnalysisRequest.traceAnalysisMode === 'query') {
          if (traceAnalysisRequest.reqTestQuery?.value) {
            traceAnalysisSettings.push(
              `Requirement to Test Query: ${traceAnalysisRequest.reqTestQuery.value}`
            );
          }
          if (traceAnalysisRequest.testReqQuery?.value) {
            traceAnalysisSettings.push(
              `Test to Requirement Query: ${traceAnalysisRequest.testReqQuery.value}`
            );
          }
        }
      }

      const sections = [
        {
          title: 'Linked MOM Settings',
          settings: linkedMomSettings,
          emptyMessage: 'No linked mom settings enabled',
        },
        {
          title: 'Trace Analysis Settings',
          settings: traceAnalysisSettings,
          emptyMessage: 'No trace analysis settings enabled',
        },
      ];

      return <SettingsDisplay sections={sections} />;
    };

    const attachmentTypeElements = (
      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
        <div>
          <FormLabel id='include-office-attachment-radio'>Included Office Files Type</FormLabel>
          <RadioGroup
            defaultValue='asEmbedded'
            name='include-office-attachment-radio'
            value={attachmentType}
            onChange={(event) => {
              setAttachmentType(event.target.value);
            }}
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
        </div>
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeAttachmentContent}
                onChange={(event, checked) => setIncludeAttachmentContent(checked)}
              />
            }
            label='Include Attachment Content'
          />
        </div>
      </Box>
    );

    return (
      <>
        <div>
          {/*
        
        TODO: add this later if needed
        <SmartAutocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={headingLevelOptions}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select an Heading level'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            setContentHeadingLevel(newValue.key);
          }}
{{ ... }}
        /> */}
        </div>
        <div>
          <SmartAutocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            loading={store.loadingState.testPlanListLoading}
            options={store.testPlansList?.map((testplan) => ({ key: testplan.id, text: testplan.name }))}
            minCharsToSearch={0}
            maxResults={200}
            clientDebounceMs={0}
            virtualizeOnInput
            virtualizeMinInputLength={1}
            label='Select a Test Plan'
            onChange={async (_event, newValue) => {
              await handleTestPlanChanged(newValue);
            }}
            value={selectedTestPlan}
          />
        </div>
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={isSuiteSpecific}
                onChange={(event, checked) => {
                  setIsSuiteSpecific(checked);
                }}
              />
            }
            label='Enable suite specific selection '
          />
        </div>
        <div>
          {isSuiteSpecific ? (
            <SmartAutocomplete
              style={{ marginBlock: 8, width: 300 }}
              multiple
              options={
                selectedTestPlan?.key
                  ? (store.testSuiteList || []).map((s) => ({ ...s, key: s.id, text: `${s.name} - (${s.id})` }))
                  : []
              }
              disableCloseOnSelect
              autoHighlight
              loading={store.loadingState.testSuiteListLoading}
              value={selectedTestSuites}
              groupBy={(option) => option.parent}
              showCheckbox
              label='With suite cases'
              onChange={async (_event, newValue) => {
                setSelectedTestSuites(newValue);
              }}
            />
          ) : null}
        </div>
        <div>
          <FormControlLabel
            label='Generate STD for Manual Formal Testing (Hard Copy)'
            control={
              <Checkbox
                checked={includeHardCopyRun}
                onChange={(event, checked) => setIncludeHardCopyRun(checked)}
              />
            }
          />
        </div>
        <div>
          <FormControlLabel
            label='Flat Test Cases of a Single Suite'
            control={
              <Checkbox
                checked={flatSuiteTestCases}
                onChange={(event, checked) => setFlatSuiteTestCases(checked)}
              />
            }
          />
        </div>
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeAttachments}
                onChange={(event, checked) => {
                  setIncludeAttachments(checked);
                }}
              />
            }
            label='Include Attachments'
          />
          {includeAttachments && attachmentTypeElements}
        </div>
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeRequirements}
                onChange={(event, checked) => {
                  setIncludeRequirements(checked);
                  if (!checked) setIncludeCustomerId(false); // Ensure Customer ID checkbox is also managed
                }}
              />
            }
            label='Include Requirements'
          />
          {includeRequirements && (
            <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeCustomerId}
                    onChange={(event, checked) => setIncludeCustomerId(checked)}
                  />
                }
                label='Include Customer ID'
              />
            </Box>
          )}
        </div>
        <Grid
          container
          direction='row'
          spacing={2}
          sx={{ mt: 1 }}
        >
          <Grid
            item
            xs={6}
          >
            <LinkedMomDialog
              store={store}
              sharedQueries={store.sharedQueries}
              prevLinkedMomRequest={linkedMomRequest}
              onLinkedMomChange={setLinkedMomRequest}
            />
          </Grid>
          <Grid
            item
            xs={6}
          >
            <TraceAnalysisDialog
              store={store}
              sharedQueries={store.sharedQueries}
              prevTraceAnalysisRequest={traceAnalysisRequest}
              onTraceAnalysisChange={setTraceAnalysisRequest}
            />
          </Grid>
          {/* Bottom row - Settings displays */}
          <Grid
            item
            xs={6}
          >
            <SettingsDisplay
              title='Linked MOM Settings'
              settings={(() => {
                const linkedMomSettings = [];
                if (linkedMomRequest.linkedMomMode !== 'none') {
                  linkedMomSettings.push(`Linked MOM Mode: ${linkedMomRequest.linkedMomMode}`);
                }
                if (linkedMomRequest.linkedMomQuery?.value) {
                  linkedMomSettings.push(`Linked MOM Query: ${linkedMomRequest.linkedMomQuery.value}`);
                }
                return linkedMomSettings;
              })()}
              emptyMessage='No linked mom settings enabled'
            />
          </Grid>
          <Grid
            item
            xs={6}
          >
            <SettingsDisplay
              title='Trace Analysis Settings'
              settings={(() => {
                const traceAnalysisSettings = [];
                if (traceAnalysisRequest.includeCommonColumnsMode !== 'both') {
                  traceAnalysisSettings.push(
                    `Include Common Columns for ${
                      traceAnalysisRequest.includeCommonColumnsMode !== 'reqOnly'
                        ? 'Test Case Only'
                        : 'Requirement Only'
                    }`
                  );
                }
                if (traceAnalysisRequest.traceAnalysisMode !== 'none') {
                  const traceMode =
                    traceAnalysisRequest.traceAnalysisMode === 'query'
                      ? 'from Query'
                      : 'from Linked Requirements';
                  traceAnalysisSettings.push(`Requirements ${traceMode}`);

                  if (traceAnalysisRequest.traceAnalysisMode === 'query') {
                    if (traceAnalysisRequest.reqTestQuery?.value) {
                      traceAnalysisSettings.push(
                        `Requirement to Test Query: ${traceAnalysisRequest.reqTestQuery.value}`
                      );
                    }
                    if (traceAnalysisRequest.testReqQuery?.value) {
                      traceAnalysisSettings.push(
                        `Test to Requirement Query: ${traceAnalysisRequest.testReqQuery.value}`
                      );
                    }
                  }
                }
                return traceAnalysisSettings;
              })()}
              emptyMessage='No trace analysis settings enabled'
            />
          </Grid>
        </Grid>

        <br />
        <br />
        {/* works only in document managing mode */}
        {editingMode ? (
          <PrimaryButton
            text='Add Content To Document'
            onClick={() => {
              UpdateDocumentRequestObject();
            }}
          />
        ) : null}
      </>
    );
  }
);

export default TestContentSelector;
