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

const STRTableSelector = observer(
  ({
    store,
    contentControlTitle,
    type,
    skin,
    testPlansList,
    testSuiteList,
    addToDocumentRequestObject,
    editingMode,
    contentControlIndex,
    sharedQueries,
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
    const [includeOpenPCRs, setIncludeOpenPCRs] = useState(false);
    const [openPCRsSelection, setOpenPCRsSelection] = useState('linked');
    const [includeTestLog, setIncludeTestLog] = useState(false);
    const [includeHardCopyRun, setIncludeHardCopyRun] = useState(false);

    const [stepExecutionState, setStepExecutionState] = useState(initialStepsExecutionState);
    const [stepAnalysisState, setStepAnalysisState] = useState(initialStepsAnalysisState);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [
      selectedTestSuites,
      includeConfigurations,
      includeHierarchy,
      includeOpenPCRs,
      openPCRsSelection,
      includeTestLog,
      includeHardCopyRun,
      stepExecutionState,
      stepAnalysisState,
    ]);
    // }, [editingMode]);

    useEffect(() => {
      const { acquiredTrees } = toJS(sharedQueries);
      acquiredTrees !== null
        ? setQueryTrees(() => ({
            testReqTree: acquiredTrees.testReqTree ? [acquiredTrees.testReqTree] : [],
          }))
        : setQueryTrees(null);
    }, [sharedQueries.acquiredTrees]);

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

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (!store.selectedFavorite?.dataToSave) return;
      loadSavedData(store.selectedFavorite.dataToSave);
    }, [store.selectedFavorite]);

    const loadSavedData = useCallback(async (dataToSave) => {
      try {
        await processTestPlanSelection(dataToSave);
        processGeneralSettings(dataToSave);
        await processTestSuiteSelections(dataToSave);
        processRequirementQueries(dataToSave);
        setStepExecutionState(dataToSave.stepExecution);
        setStepAnalysisState(dataToSave.stepAnalysis);
      } catch (error) {
        console.error('Error loading saved data:', error);
        toast.error(`Error loading saved data: ${error.message}`);
      }
    }, []);

    const processTestPlanSelection = useCallback(
      async (dataToSave) => {
        const testPlan = testPlansList.find((testplan) => testplan.id === dataToSave.testPlanId);
        if (!testPlan) {
          toast.warn(`Test plan with ID ${dataToSave.testPlanId} not found`);
          return;
        }
        await handleTestPlanChanged({ key: dataToSave.testPlanId, text: testPlan.name });
      },
      [testPlansList, handleTestPlanChanged]
    );

    const processGeneralSettings = useCallback((dataToSave) => {
      setIncludeConfigurations(dataToSave.includeConfigurations);
      setIncludeHierarchy(dataToSave.includeHierarchy);
      setIncludeOpenPCRs(dataToSave.includeOpenPCRs);
      setOpenPCRsSelection(dataToSave.openPCRsSelection);
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

    const processRequirementQueries = useCallback(
      (dataToSave) => {
        const testReqQuery = dataToSave.stepExecution?.generateRequirements?.testReqQuery;
        if (testReqQuery && sharedQueries?.acquiredTrees?.testReqTree) {
          const validTestReqQuery = validateQuery([sharedQueries.acquiredTrees.testReqTree], testReqQuery);

          if (!validTestReqQuery) {
            toast.warn(
              `Previously selected Test-Requirement query "${testReqQuery.title}" not found or invalid`
            );
          }

          dataToSave.stepExecution.generateRequirements.testReqQuery = validTestReqQuery;
        }
      },
      [sharedQueries?.acquiredTrees?.testReqTree]
    );
    function UpdateDocumentRequestObject() {
      let testSuiteIdList = undefined;
      let nonRecursiveTestSuiteIdList = undefined;
      if (isSuiteSpecific) {
        testSuiteIdList = [];
        nonRecursiveTestSuiteIdList = [];
        // Function to recursively add children suites
        const addChildrenSuites = (suiteId) => {
          const suite = testSuiteList.find((suite) => suite.id === suiteId);
          if (suite && !testSuiteIdList.includes(suiteId)) {
            testSuiteIdList.push(suiteId);
            const children = testSuiteList.filter((child) => child.parent === suiteId);
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
            includeOpenPCRs: includeOpenPCRs,
            openPCRsSelection: openPCRsSelection,
            includeTestLog: includeTestLog,
            stepExecution: stepExecutionState,
            stepAnalysis: stepAnalysisState,
            includeHardCopyRun: includeHardCopyRun,
          },
        },
        contentControlIndex
      );
    }

    const openPcrsElements = (
      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
        <RadioGroup
          defaultValue='query'
          name='open-pcr-buttons-group'
          value={openPCRsSelection}
          onChange={(event) => {
            setOpenPCRsSelection(event.target.value);
          }}
        >
          <FormControlLabel
            value='query'
            label='From Query'
            control={<Radio />}
            //TODO: remove this after query open pcr implementation
            disabled={true}
          />
          <FormControlLabel
            value='linked'
            label='From Linked CR / Bugs'
            control={<Radio />}
          />
        </RadioGroup>
      </Box>
    );

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

        {/*TBD: <div>
        <FormControlLabel
          label='Generate Linked PCRs'
          control={
            <Checkbox
              checked={stepAnalysisState.isGenerateLinkPcrsEnabled}
              onChange={(event, checked) => {
                setStepAnalysisState((prev) => ({ ...prev, isGenerateLinkPcrsEnabled: checked }));
              }}
            />
          }
        />
      </div> */}
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
            options={testPlansList.map((testplan) => {
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
              options={testSuiteList}
              disableCloseOnSelect
              autoHighlight
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
          <FormControlLabel
            control={
              <Checkbox
                checked={includeOpenPCRs}
                onChange={(event, checked) => {
                  setIncludeOpenPCRs(checked);
                }}
              />
            }
            label='Open PCRs'
          />

          {includeOpenPCRs && openPcrsElements}
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
