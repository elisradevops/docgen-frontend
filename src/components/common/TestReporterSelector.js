import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Transfer } from 'antd';
import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import SmartAutocomplete from './SmartAutocomplete';
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

// Checkboxes for multi-select in suites are rendered internally by SmartAutocomplete when showCheckbox=true

const BASE_FIELDS = [
  { text: 'Execution Date', key: 'executionDate@runResultField' },
  { text: 'Test Case Run Result', key: 'testCaseResult@runResultField' },
  { text: 'Failure Type', key: 'failureType@runResultField' },
  { text: 'Test Case Comment', key: 'testCaseComment@runResultField' },
  { text: 'Include Test Steps (Action and Expected)', key: 'includeSteps@stepsRunProperties' },
  { text: 'Step Actual Result (Step comment)', key: 'testStepComment@stepsRunProperties' },
  { text: 'Step Run Result', key: 'stepRunStatus@stepsRunProperties' },
  { text: 'Run By', key: 'runBy@runResultField' },
  { text: 'Configuration', key: 'configurationName@runResultField' },
];

const LINKED_MODE_FIELDS = [
  { text: 'Associated Requirement', key: 'associatedRequirement@linked' },
  { text: 'Associated Bug', key: 'associatedBug@linked' },
  { text: 'Associated CR', key: 'associatedCR@linked' },
];

const TestReporterSelector = observer(
  ({ store, selectedTeamProject, addToDocumentRequestObject, contentControlIndex }) => {
    const [selectedTestPlan, setSelectedTestPlan] = useState(defaultItem);
    const [selectedTestSuites, setSelectedTestSuites] = useState([]);
    const [allowCrossTestPlan, setAllowCrossTestPlan] = useState(false);
    const [errorFilterMode, setErrorFilterMode] = useState('none');
    const [allowGrouping, setAllowGrouping] = useState(false);
    const [enableRunTestCaseFilter, setEnableRunTestCaseFilter] = useState(false);
    const [enableRunStepStatusFilter, setEnableRunStepStatusFilter] = useState(false);
    const [selectedFields, setSelectedFields] = useState([]);
    const [linkedQueryRequest, setLinkedQueryRequest] = useState(defaultSelectedQueries);

    const fieldsToSelect = useMemo(() => {
      const customFields =
        store.fieldsByType?.map((field) => ({
          key: `${field.key}@testCaseWorkItemField`,
          text: field.text,
        })) || [];

      let allFields = [...BASE_FIELDS, ...LINKED_MODE_FIELDS];
      //sort the custom fields by name
      customFields.sort((a, b) => a.text.localeCompare(b.text));
      allFields.push(...customFields);

      // Filter out fields ending with "@linked"
      return linkedQueryRequest.linkedQueryMode !== 'linked'
        ? allFields.filter(
            (field) => field && typeof field.key === 'string' && !field.key.endsWith('@linked')
          )
        : allFields;
    }, [linkedQueryRequest.linkedQueryMode, store.fieldsByType]);

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

    // Count selected suites including their descendants (unique)
    const selectedSuitesDescendantCount = useMemo(() => {
      if (!selectedTestSuites || selectedTestSuites.length === 0) return 0;
      const all = store.testSuiteList || [];
      const set = new Set();
      const addChildren = (id) => {
        if (set.has(id)) return;
        set.add(id);
        all.filter((s) => s.parent === id).forEach((child) => addChildren(child.id));
      };
      selectedTestSuites.forEach((s) => addChildren(s.id));
      return set.size;
    }, [selectedTestSuites, store.testSuiteList]);

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
      const errorFilterMode = dataToSave?.errorFilterMode;
      if (allowCrossTestPlan) {
        setAllowCrossTestPlan(allowCrossTestPlan);
      }
      if (allowGrouping !== undefined) {
        setAllowGrouping(allowGrouping);
      }
      if (errorFilterMode !== undefined) {
        setErrorFilterMode(errorFilterMode);
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
              errorFilterMode: errorFilterMode,
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
      errorFilterMode,
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
          spacing={1}
          alignItems='center'
          sx={{ marginY: 1, justifyContent: 'center' }}
        >
          <Grid
            item
            xs={12}
          >
            <Paper
              variant='outlined'
              sx={{ p: 1.25 }}
            >
              <Typography
                variant='subtitle2'
                sx={{ mb: 0.5 }}
              >
                Scope
              </Typography>
              <Grid
                container
                spacing={1}
                alignItems='center'
              >
                <Grid
                  item
                  xs={4}
                >
                  <SmartAutocomplete
                    size='small'
                    disableClearable
                    autoHighlight
                    openOnFocus
                    loading={store.loadingState.testPlanLoadingState}
                    options={store.testPlansList.map((testplan) => ({
                      key: testplan.id,
                      text: testplan.name,
                    }))}
                    label='Select a Test Plan'
                    textFieldProps={{
                      size: 'small',
                      sx: {
                        '& .MuiInputBase-root': { minHeight: 56 },
                      },
                    }}
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
                  <SmartAutocomplete
                    multiple
                    size='small'
                    options={selectedTestPlan?.key ? store.testSuiteList : []}
                    loading={store.loadingState.testSuiteListLoading}
                    disableCloseOnSelect
                    autoHighlight
                    groupBy={(option) => {
                      const parent = suiteById.get(option.parent);
                      return parent ? `Parent: ${parent.name}` : 'Top Level';
                    }}
                    getOptionLabel={(option) => `${option.name} - (${option.id})`}
                    optionValueKey='id'
                    label='Test Suites (include child suites)'
                    placeholder='Search suites...'
                    textFieldProps={{
                      size: 'small',
                      helperText: selectedTestPlan?.key
                        ? 'Descendants are auto-included'
                        : 'Select a test plan first',
                    }}
                    showCheckbox
                    disabled={!selectedTestPlan?.key}
                    onChange={async (_event, newValue) => {
                      setSelectedTestSuites(newValue);
                    }}
                    value={selectedTestSuites}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          <Grid
            item
            xs={12}
          >
            <Paper
              variant='outlined'
              sx={{ p: 1.25 }}
            >
              <Typography
                variant='subtitle2'
                sx={{ mb: 0.5 }}
              >
                Filters and Linked Items
              </Typography>
              <Grid
                container
                spacing={1}
              >
                <Grid
                  item
                  xs={5}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size='small'
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
                          size='small'
                          checked={allowCrossTestPlan}
                          onChange={(event, checked) => {
                            setAllowCrossTestPlan(checked);
                          }}
                        />
                      }
                      label='Include results from other test plans'
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size='small'
                          checked={enableRunTestCaseFilter}
                          onChange={(event, checked) => {
                            setEnableRunTestCaseFilter(checked);
                          }}
                        />
                      }
                      label='Only include executed test cases'
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size='small'
                          checked={enableRunStepStatusFilter}
                          onChange={(event, checked) => {
                            setEnableRunStepStatusFilter(checked);
                          }}
                        />
                      }
                      label='Only include executed steps'
                    />
                  </Box>
                </Grid>
                <Grid
                  item
                  xs={7}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <FormLabel id='error-filter-mode-label'>Error Filter Mode</FormLabel>
                    <RadioGroup
                      row
                      name='error-filter-mode'
                      aria-labelledby='error-filter-mode-label'
                      value={errorFilterMode}
                      onChange={(event) => {
                        setErrorFilterMode(event.target.value);
                      }}
                    >
                      <FormControlLabel
                        value='none'
                        label='None'
                        control={<Radio size='small' />}
                      />
                      <FormControlLabel
                        value='onlyTestCaseResult'
                        label='By test case level'
                        control={<Radio size='small' />}
                      />
                      <FormControlLabel
                        value='onlyTestStepsResult'
                        label='By step level'
                        control={<Radio size='small' />}
                      />
                      <FormControlLabel
                        value='both'
                        label='By test case and step level'
                        control={<Radio size='small' />}
                      />
                    </RadioGroup>
                    <FormLabel id='linked-item-query-group-label'>Linked Item Fetch Type</FormLabel>
                    <RadioGroup
                      row
                      name='linked-item-query-group'
                      aria-labelledby='linked-item-query-group-label'
                      value={linkedQueryRequest.linkedQueryMode}
                      onChange={(event) => {
                        handleLinkedQueryChange(event.target.value);
                      }}
                    >
                      <FormControlLabel
                        value='none'
                        label='None'
                        control={<Radio size='small' />}
                      />
                      <FormControlLabel
                        value='linked'
                        label='Linked'
                        control={<Radio size='small' />}
                      />
                      <FormControlLabel
                        value='query'
                        label='Query'
                        control={<Radio size='small' />}
                        disabled={
                          !queryTrees.testAssociatedTree || queryTrees.testAssociatedTree.length === 0
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
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid
            item
            xs={12}
          >
            <Paper
              variant='outlined'
              sx={{ p: 1.25 }}
            >
              <Typography
                variant='subtitle2'
                sx={{ mb: 0.5 }}
              >
                Columns (Fields)
              </Typography>
              <Transfer
                showSearch
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'flex-start',
                }}
                listStyle={{
                  width: 'calc(50% - 20px)',
                  flexGrow: 1,
                  height: '240px',
                }}
                listHeight={280}
                dataSource={fieldsToSelect}
                targetKeys={selectedFields}
                render={(item) => item.text}
                onChange={(nextTargetKeys) => {
                  setSelectedFields(nextTargetKeys);
                }}
                titles={['Available Fields', 'Selected Fields']}
                filterOption={(input, option) => option.text.toLowerCase().includes(input.toLowerCase())}
              />
            </Paper>
          </Grid>
        </Grid>
      </Collapse>
    );
  }
);

export default TestReporterSelector;
