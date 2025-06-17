import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Transfer } from 'antd';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import {
  Autocomplete,
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';
import QueryTree from './QueryTree';
import { validateQuery } from '../../utils/queryValidation';
import { toJS } from 'mobx';
const defaultItem = {
  key: '',
  text: '',
};
const defaultSelectedQueries = {
  linkedQueryMode: 'none',
  testAssociatedQuery: null,
  includeCommonColumnsMode: 'both',
};

const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;

const TestReporterSelector = observer(
  ({ store, selectedTeamProject, addToDocumentRequestObject, contentControlIndex }) => {
    const [selectedTestPlan, setSelectedTestPlan] = useState(defaultItem);
    const [selectedTestSuites, setSelectedTestSuites] = useState([]);
    const [allowCrossTestPlan, setAllowCrossTestPlan] = useState(false);
    const [allowGrouping, setAllowGrouping] = useState(false);
    const [enableRunTestCaseFilter, setEnableRunTestCaseFilter] = useState(false);
    const [enableRunStepStatusFilter, setEnableRunStepStatusFilter] = useState(false);
    const [selectedFields, setSelectedFields] = useState([]);
    const [linkedQueryRequest, setLinkedQueryRequest] = useState(defaultSelectedQueries);

    const fieldsToSelect = useMemo(() => {
      const baseFields = [
        { text: 'Execution Date', key: 'executionDate@runResultField' },
        { text: 'Test Case Run Result', key: 'testCaseResult@runResultField' },
        { text: 'Failure Type', key: 'failureType@runResultField' },
        { text: 'Test Case Comment', key: 'testCaseComment@runResultField' },
        { text: 'Include Test Steps (Action and Expected)', key: 'includeSteps@stepsRunProperties' },
        { text: 'Step Actual Result (Step comment)', key: 'testStepComment@stepsRunProperties' },
        { text: 'Step Run Result', key: 'stepRunStatus@stepsRunProperties' },
        { text: 'Run By', key: 'runBy@runResultField' },
        { text: 'Configuration', key: 'configurationName@runResultField' },
        {
          text: 'Automation Status',
          key: 'Microsoft.VSTS.TCM.AutomationStatus@testCaseWorkItemField',
        },
        { text: 'Assigned To', key: 'System.AssignedTo@testCaseWorkItemField' },
        { text: 'SubSystem', key: 'Custom.SubSystem@testCaseWorkItemField' },
        { text: 'Priority', key: 'priority@runResultField' },
      ];

      if (linkedQueryRequest.linkedQueryMode === 'linked') {
        return [
          ...baseFields,
          { text: 'Associated Requirement', key: 'associatedRequirement@linked' },
          { text: 'Associated Bug', key: 'associatedBug@linked' },
          { text: 'Associated CR', key: 'associatedCR@linked' },
        ];
      }
      return baseFields;
    }, [linkedQueryRequest.linkedQueryMode]);

    useEffect(() => {
      // If the mode is not 'linked' (i.e., it's 'none' or 'query')
      if (linkedQueryRequest.linkedQueryMode !== 'linked') {
        // Remove any selected fields that are specific to the 'linked' mode
        // Also ensure field and field.key are valid before calling endsWith
        setSelectedFields((currentFields) =>
          currentFields.filter(
            (field) => field && typeof field.key === 'string' && !field.key.endsWith('@linked')
          )
        );
      }
    }, [linkedQueryRequest.linkedQueryMode]);

    const [queryTrees, setQueryTrees] = useState({
      testAssociatedTree: [],
    });

    useEffect(() => {
      if (!store.sharedQueries) return;
      const { acquiredTrees } = toJS(store.sharedQueries);
      acquiredTrees !== null
        ? setQueryTrees(() => ({
            testAssociatedTree: acquiredTrees.testAssociatedTree?.testAssociatedTree
              ? [acquiredTrees.testAssociatedTree.testAssociatedTree]
              : [],
          }))
        : setQueryTrees({ testAssociatedTree: [] });
    }, [store.sharedQueries, store.sharedQueries.acquiredTrees]);

    const handleTestPlanChanged = useCallback(
      async (newValue) => {
        await store.fetchTestSuitesList(newValue.key);
        setSelectedTestSuites([]);
        if (newValue.text) {
          let testPlanNameForFile = newValue.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
          store.setContextName(testPlanNameForFile);
        }
        setSelectedTestPlan(newValue);
      },
      [store]
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

    const processTestSuiteSelections = useCallback(
      (dataToSave) => {
        const testSuiteList = store.getTestSuiteList;
        if (dataToSave?.nonRecursiveTestSuiteIdList?.length > 0) {
          const validTestSuites = dataToSave.nonRecursiveTestSuiteIdList
            .map((suiteId) => testSuiteList.find((suite) => suite.id === suiteId))
            .filter(Boolean);

          if (validTestSuites.length > 0) {
            setSelectedTestSuites(validTestSuites);
          }
        } else {
          setSelectedTestSuites([]);
        }
      },
      [store.getTestSuiteList]
    );

    const processSavedFields = useCallback((dataToSave) => {
      const selectedFields = dataToSave?.selectedFields || [];
      if (selectedFields.length > 0) {
        setSelectedFields(selectedFields);
      } else {
        setSelectedFields([]);
      }
    }, []);

    const processFilters = useCallback((dataToSave) => {
      const allowCrossTestPlan = dataToSave?.allowCrossTestPlan;
      const runStepStatusFilter = dataToSave?.enableRunStepStatusFilter;
      const runTestCaseFilter = dataToSave?.enableRunTestCaseFilter;
      const allowGrouping = dataToSave?.allowGrouping;
      if (allowCrossTestPlan) {
        setAllowCrossTestPlan(allowCrossTestPlan);
      }
      if (allowGrouping !== undefined) {
        setAllowGrouping(allowGrouping);
      }
      if (runStepStatusFilter !== undefined) {
        setEnableRunStepStatusFilter(runStepStatusFilter);
      }
      if (runTestCaseFilter !== undefined) {
        setEnableRunTestCaseFilter(runTestCaseFilter);
      }
    }, []);

    const processSavedQueries = useCallback(
      (linkedQueryRequest) => {
        if (!linkedQueryRequest || !store.sharedQueries) {
          return;
        }
        const validatedRequest = { ...linkedQueryRequest };
        if (
          linkedQueryRequest.testAssociatedQuery &&
          store.sharedQueries?.acquiredTrees?.testAssociatedTree
        ) {
          const validTestAssociatedQuery = validateQuery(
            [store.sharedQueries.acquiredTrees?.testAssociatedTree?.testAssociatedTree],
            linkedQueryRequest.testAssociatedQuery
          );
          if (!validTestAssociatedQuery && linkedQueryRequest.testAssociatedQuery) {
            toast.warn(
              `Previously selected Test-Associated query "${linkedQueryRequest.testAssociatedQuery.title}" not found or invalid`
            );
          }
          validatedRequest.testAssociatedQuery = validTestAssociatedQuery;
        }
        setLinkedQueryRequest(validatedRequest);
      },
      [store.sharedQueries]
    );

    const loadSavedData = useCallback(
      async (dataToSave) => {
        await processTestPlanSelection(dataToSave);
        processTestSuiteSelections(dataToSave);
        processSavedFields(dataToSave);
        processFilters(dataToSave);
        processSavedQueries(dataToSave.linkedQueryRequest);
      },
      [
        processFilters,
        processSavedFields,
        processTestPlanSelection,
        processTestSuiteSelections,
        processSavedQueries,
      ]
    );

    useEffect(() => {
      if (!store.selectedFavorite?.dataToSave) return;
      loadSavedData(store.selectedFavorite.dataToSave);
    }, [loadSavedData, store.selectedFavorite]);

    useEffect(() => {
      const updateTestReporterRequestObject = () => {
        let testSuiteIdList = undefined;
        let nonRecursiveTestSuiteIdList = undefined;

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

        addToDocumentRequestObject(
          {
            type: 'testReporter',
            title: 'test-reporter-content-control',
            skin: 'testReporter',
            data: {
              testPlanId: selectedTestPlan.key,
              testSuiteArray: testSuiteIdList,
              nonRecursiveTestSuiteIdList: nonRecursiveTestSuiteIdList,
              allowCrossTestPlan: allowCrossTestPlan,
              enableRunTestCaseFilter: enableRunTestCaseFilter,
              enableRunStepStatusFilter: enableRunStepStatusFilter,
              allowGrouping: allowGrouping,
              selectedFields: selectedFields,
              linkedQueryRequest: linkedQueryRequest,
            },
            isExcelSpreadsheet: true,
          },
          contentControlIndex
        );
      };
      updateTestReporterRequestObject();
    }, [
      selectedTestPlan,
      selectedTestSuites,
      selectedFields,
      store.testSuiteList,
      addToDocumentRequestObject,
      enableRunStepStatusFilter,
      contentControlIndex,
      enableRunTestCaseFilter,
      allowCrossTestPlan,
      allowGrouping,
      linkedQueryRequest,
    ]);

    const onQuerySelected = useCallback((query) => {
      setLinkedQueryRequest((prev) => ({ ...prev, testAssociatedQuery: query }));
    }, []);

    const handleLinkedQueryChange = (value) => {
      if (value === 'query') {
        setLinkedQueryRequest((prev) => ({ ...prev, linkedQueryMode: value }));
      } //In case of None or Linked requirement
      else {
        setLinkedQueryRequest({ ...defaultSelectedQueries, linkedQueryMode: value });
      }
    };

    return (
      <Collapse
        in={selectedTeamProject.key !== ''}
        timeout='auto'
        unmountOnExit
      >
        <Grid
          container
          spacing={2}
          alignItems='center'
          sx={{ marginY: 1, justifyContent: 'center' }}
        >
          <Grid
            item
            xs={4}
          >
            <Autocomplete
              disableClearable
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
          </Grid>
          <Grid
            item
            xs={8}
          >
            <Autocomplete
              multiple
              options={store.testSuiteList}
              loading={store.loadingState.testSuitesLoadingState}
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
          </Grid>
          <Grid
            item
            xs={12}
          >
            <Stack
              direction='row'
              spacing={2}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allowGrouping}
                      onChange={(event, checked) => {
                        setAllowGrouping(checked);
                      }}
                    />
                  }
                  label='Allow Grouping by Test Suite'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allowCrossTestPlan}
                      onChange={(event, checked) => {
                        setAllowCrossTestPlan(checked);
                      }}
                    />
                  }
                  label='Allow Results From Cross Test Plans'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enableRunTestCaseFilter}
                      onChange={(event, checked) => {
                        setEnableRunTestCaseFilter(checked);
                      }}
                    />
                  }
                  label='Filter Out Not Run Test Cases'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enableRunStepStatusFilter}
                      onChange={(event, checked) => {
                        setEnableRunStepStatusFilter(checked);
                      }}
                    />
                  }
                  label='Filter Out Not Run Steps'
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <FormLabel
                  id='linked-item-query-group'
                  label='Linked Item Fetch Type'
                >
                  Linked Item Based on:
                </FormLabel>
                <RadioGroup
                  defaultValue='none'
                  row
                  name='linked-item-query-group'
                  value={linkedQueryRequest.linkedQueryMode}
                  onChange={(event) => {
                    handleLinkedQueryChange(event.target.value);
                  }}
                >
                  <FormControlLabel
                    value='none'
                    label='None'
                    control={<Radio />}
                  />
                  <FormControlLabel
                    value='linked'
                    label='Linked'
                    control={<Radio />}
                  />
                  <FormControlLabel
                    value='query'
                    label='Query'
                    control={<Radio />}
                    disabled={
                      queryTrees.testAssociatedTree === null || !queryTrees.testAssociatedTree.length > 0
                    }
                  />
                </RadioGroup>
                <Collapse
                  in={linkedQueryRequest.linkedQueryMode === 'query'}
                  timeout='auto'
                  unmountOnExit
                >
                  <QueryTree
                    data={queryTrees.testAssociatedTree}
                    prevSelectedQuery={linkedQueryRequest.testAssociatedQuery}
                    onSelectedQuery={onQuerySelected}
                    queryType={'test-associated'}
                    isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                  />
                </Collapse>
              </Box>
            </Stack>
          </Grid>
          {/* Empty Space */}
          <Grid
            item
            xs={8}
          />

          <Grid
            item
            xs={12}
          >
            <Transfer
              showSearch
              style={{
                width: '75%',
                display: 'flex',
                justifyContent: 'start',
              }}
              listStyle={{
                width: 'calc(50% - 20px)', // Each list takes almost half the width
                flexGrow: 1,
                height: '300px',
              }}
              listHeight={350} // Controls the scrollable area height
              dataSource={fieldsToSelect}
              targetKeys={selectedFields}
              render={(item) => item.text}
              onChange={(nextTargetKeys) => {
                setSelectedFields(nextTargetKeys);
              }}
              titles={['Available Fields', 'Selected Fields']}
            />
          </Grid>
        </Grid>
      </Collapse>
    );
  }
);

export default TestReporterSelector;
