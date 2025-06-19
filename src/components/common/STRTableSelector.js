import React, { useState, useEffect, useCallback } from 'react';
// import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { PrimaryButton } from '@fluentui/react';
import { FormLabel, Box, Radio, RadioGroup, Collapse, Typography } from '@mui/material';
import { toJS } from 'mobx';
import DetailedStepsSettingsDialog from '../dialogs/DetailedStepsSettingsDialog';
import { observer } from 'mobx-react';
import { validateQuery } from '../../utils/queryValidation';
import { toast } from 'react-toastify';
import OpenPcrDialog from '../dialogs/OpenPcrDialog';
const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;

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
  },
};

const initialStepsAnalysisState = {
  isEnabled: false,
  generateRunAttachments: { isEnabled: false, attachmentType: 'asEmbedded', includeAttachmentContent: false },
  isGenerateLinkPcrsEnabled: false,
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
    const [contentHeadingLevel, setContentHeadingLevel] = useState(1);
    const [isSuiteSpecific, setIsSuiteSpecific] = useState(false);
    const [includeConfigurations, setIncludeConfigurations] = useState(false);
    const [includeHierarchy, setIncludeHierarchy] = useState(false);
    // const [includeOpenPCRs, setIncludeOpenPCRs] = useState(false);
    const [openPCRsSelectionRequest, setOpenPCRsSelectionRequest] = useState(defaultSelectedQueries);
    // const [openPCRsSelection, setOpenPCRsSelection] = useState('linked');
    const [includeTestLog, setIncludeTestLog] = useState(false);
    const [includeHardCopyRun, setIncludeHardCopyRun] = useState(false);

    const [stepExecutionState, setStepExecutionState] = useState(initialStepsExecutionState);
    const [stepAnalysisState, setStepAnalysisState] = useState(initialStepsAnalysisState);

    const UpdateDocumentRequestObject = useCallback(() => {
      let testSuiteIdList = undefined;
      let nonRecursiveTestSuiteIdList = undefined;
      if (isSuiteSpecific) {
        testSuiteIdList = [];
        nonRecursiveTestSuiteIdList = [];
        // Function to recursively add children suites
        const addChildrenSuites = (suiteId) => {
          const suite = store.testSuiteList.find((suite) => suite.id === suiteId);
          if (suite && !testSuiteIdList.includes(suiteId)) {
            testSuiteIdList.push(suiteId);
            const children = store.testSuiteList.filter((child) => child.parent === suiteId);
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
            includeConfigurations: includeConfigurations,
            includeHierarchy: includeHierarchy,
            openPCRsSelectionRequest: openPCRsSelectionRequest,
            // includeOpenPCRs: includeOpenPCRs,
            // openPCRsSelection: openPCRsSelection,
            includeTestLog: includeTestLog,
            stepExecution: stepExecutionState,
            stepAnalysis: stepAnalysisState,
            includeHardCopyRun: includeHardCopyRun,
          },
        },
        contentControlIndex
      );
    }, [
      isSuiteSpecific,
      store.testSuiteList,
      selectedTestSuites,
      addToDocumentRequestObject,
      type,
      contentControlTitle,
      skin,
      contentHeadingLevel,
      selectedTestPlan.key,
      includeConfigurations,
      includeHierarchy,
      openPCRsSelectionRequest,
      includeTestLog,
      stepExecutionState,
      stepAnalysisState,
      includeHardCopyRun,
      contentControlIndex,
    ]);

    useEffect(() => {
      if (editingMode === false) {
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
    }, []);

    const processTestSuiteSelections = useCallback(
      (dataToSave) => {
        const testSuiteList = store.getTestSuiteList;
        if (dataToSave?.nonRecursiveTestSuiteIdList?.length > 0) {
          const validTestSuites = dataToSave.nonRecursiveTestSuiteIdList
            .map((suiteId) => testSuiteList.find((suite) => suite.id === suiteId))
            .filter(Boolean);

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

          if (!validTestOpenPcrQuery && openPCRsSelectionRequest.testToOpenPcrQuery) {
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

          if (!validOpenPCRTestQuery && openPCRsSelectionRequest.OpenPcrToTestQuery) {
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
        const testReqQuery = dataToSave.stepExecution?.generateRequirements?.testReqQuery;
        if (testReqQuery && store.sharedQueries?.acquiredTrees?.reqTestTrees?.testReqTree) {
          const validTestReqQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.reqTestTrees.testReqTree],
            testReqQuery
          );

          if (!validTestReqQuery) {
            toast.warn(
              `Previously selected Test-Requirement query "${testReqQuery.title}" not found or invalid`
            );
          }

          dataToSave.stepExecution.generateRequirements.testReqQuery = validTestReqQuery;
        }
      },
      [store.sharedQueries?.acquiredTrees?.reqTestTrees?.testReqTree]
    );
    const processTestPlanSelection = useCallback(
      async (dataToSave) => {
        const testPlan = store.testPlansList.find((testplan) => testplan.id === dataToSave.testPlanId);
        if (!testPlan) {
          toast.warn(`Test plan with ID ${dataToSave.testPlanId} not found`);
          return;
        }
        await handleTestPlanChanged({ key: dataToSave.testPlanId, text: testPlan.name });
      },
      [store.testPlansList, handleTestPlanChanged]
    );

    const loadSavedData = useCallback(
      async (dataToSave) => {
        try {
          await processTestPlanSelection(dataToSave);
          processGeneralSettings(dataToSave);
          processOpenPcrRequest(dataToSave.openPCRsSelectionRequest);
          await processTestSuiteSelections(dataToSave);
          processRequirementQueries(dataToSave);
          setStepExecutionState(dataToSave.stepExecution);
          setStepAnalysisState(dataToSave.stepAnalysis);
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

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (!store.selectedFavorite?.dataToSave) return;
      loadSavedData(store.selectedFavorite.dataToSave);
    }, [loadSavedData, store.selectedFavorite]);

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
          openPCRsSelectionRequest.openPcrMode === 'query' ? 'from Query' : 'from Linked Requirements';
        settings.push(`Requirements ${traceMode}`);

        if (openPCRsSelectionRequest.openPcrMode === 'query') {
          if (openPCRsSelectionRequest.testToOpenPcrQuery?.value) {
            settings.push(`Test to Open PCR Query: ${openPCRsSelectionRequest.testToOpenPcrQuery.value}`);
          }
          if (openPCRsSelectionRequest.OpenPcrToTestQuery?.value) {
            settings.push(`Open PCR To Test Query: ${openPCRsSelectionRequest.OpenPcrToTestQuery.value}`);
          }
        }
      }

      return (
        <Box>
          <Typography
            variant='subtitle2'
            color='textSecondary'
            sx={{ whiteSpace: 'pre-line' }}
          >
            {settings.length > 0 ? `Included:\n${settings.join('\n')}` : 'No trace analysis settings enabled'}
          </Typography>
        </Box>
      );
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
                (event) => handleChange(event, setStepAnalysisState, 'generateRunAttachments')
              )}
          </div>
          <div>
            <FormControlLabel
              checked={stepAnalysisState.generateRunAttachments.includeAttachmentContent}
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
                    generateRunAttachments: { ...prev.generateRunAttachments, isEnabled: checked },
                  }))
                }
              />
            }
          />
          {stepAnalysisState.generateRunAttachments.isEnabled && attachmentTypeElements('analysis')}
        </div>
      </Box>
    );

    const generateIncludedStepExecutionSettings = () => {
      const settings = [];

      if (stepExecutionState.isEnabled) {
        if (stepExecutionState.generateAttachments.isEnabled) {
          settings.push(
            `Attachments as ${
              stepExecutionState.generateAttachments.attachmentType === 'asEmbedded' ? 'Embedded' : 'Link'
            }`
          );
          if (stepExecutionState.generateAttachments.runAttachmentMode !== 'both') {
            settings.push(
              `Evidence Attachment by ${
                stepExecutionState.generateAttachments.runAttachmentMode === 'runOnly'
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
            stepExecutionState.generateRequirements.requirementInclusionMode === 'query'
              ? 'from Query'
              : 'from Linked Requirements';
          const customerId = stepExecutionState.generateRequirements.includeCustomerId
            ? ' with Customer ID'
            : '';
          settings.push(`Requirements ${reqMode}${customerId}`);
          if (stepExecutionState.generateRequirements.testReqQuery?.value) {
            settings.push(`Selected Query: ${stepExecutionState.generateRequirements.testReqQuery.value}`);
          }
        }
      }

      return (
        <Box sx={{ maxWidth: 300 }}>
          <Typography
            variant='subtitle2'
            color='textSecondary'
            sx={{ whiteSpace: 'pre-line' }}
          >
            {settings.length > 0 ? `Included:\n${settings.join('\n')}` : 'No additional settings enabled'}
          </Typography>
        </Box>
      );
    };

    async function handleTestPlanChanged(value) {
      await store.fetchTestSuitesList(value.key);
      setSelectedTestSuites([]);
      if (value.text) {
        let testPlanNameForFile = value.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
        store.setContextName(testPlanNameForFile);
      }
      setSelectedTestPlan(value);
    }

    return (
      <>
        <div>
          <Autocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={store.testPlansList.map((testplan) => {
              return { key: testplan.id, text: testplan.name };
            })}
            getOptionLabel={(option) => `${option.text}`}
            renderInput={(params) => (
              <TextField
                {...params}
                label='Select a Test Plan'
                variant='outlined'
              />
            )}
            onChange={async (event, newValue) => {
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
            label='Enable suite specific selection'
          />
        </div>
        {isSuiteSpecific && (
          <div>
            <Autocomplete
              style={{ marginBlock: 8, width: 300 }}
              multiple
              options={store.testSuiteList}
              disableCloseOnSelect
              autoHighlight
              loading={store.loadingState.testSuitesLoadingState}
              groupBy={(option) => option.parent}
              getOptionLabel={(option) => `${option.name} - (${option.id})`}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={icon}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {`${option.name} - (${option.id})`}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='With suite cases'
                  variant='outlined'
                />
              )}
              onChange={async (event, newValue) => {
                setSelectedTestSuites(newValue);
              }}
              value={selectedTestSuites}
            />
          </div>
        )}
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeConfigurations}
                onChange={(event, checked) => {
                  setIncludeConfigurations(checked);
                }}
              />
            }
            label='Display Configuration Name'
          />
        </div>

        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeHierarchy}
                onChange={(event, checked) => {
                  setIncludeHierarchy(checked);
                }}
              />
            }
            label='Display Test Group Hierarchy'
          />
        </div>

        <div>
          <OpenPcrDialog
            store={store}
            sharedQueries={store.sharedQueries}
            prevOpenPcrRequest={openPCRsSelectionRequest}
            onOpenPcrChange={setOpenPCRsSelectionRequest}
          />
          {generateIncludedOpenPcrSettings()}
        </div>

        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeTestLog}
                onChange={(event, checked) => {
                  setIncludeTestLog(checked);
                }}
              />
            }
            label='Test Log'
          />
        </div>

        <div>
          <FormControlLabel
            label='Generate STR for Manual Formal Testing (Hard Copy)'
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
            control={
              <Checkbox
                checked={stepExecutionState.isEnabled}
                onChange={(event, checked) => {
                  setStepExecutionState((prev) => ({ ...prev, isEnabled: checked }));
                }}
              />
            }
            label='Generate Detailed Steps Execution'
          />

          <Collapse
            in={stepExecutionState.isEnabled}
            timeout='auto'
            unmountOnExit
          >
            <DetailedStepsSettingsDialog
              store={store}
              queryTrees={queryTrees}
              prevStepExecution={stepExecutionState}
              onStepExecutionStateChange={setStepExecutionState}
            />
            <div>{generateIncludedStepExecutionSettings()}</div>
          </Collapse>
        </div>

        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={stepAnalysisState.isEnabled}
                onChange={(event, checked) => {
                  setStepAnalysisState((prev) => ({ ...prev, isEnabled: checked }));
                }}
              />
            }
            label='Generate Detailed Steps Analysis'
          />

          {stepAnalysisState.isEnabled && detailedStepsAnalysisElements}
        </div>

        <br />
        <br />
        {/* works only in document managing mode */}
        {editingMode ? (
          <PrimaryButton
            disabled={selectedTestSuites.length === 0}
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
export default STRTableSelector;
