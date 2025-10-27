import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Transfer } from 'antd';
import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import SmartAutocomplete from '../SmartAutocomplete';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';
import QueryTree from '../QueryTree';
import { validateQuery } from '../../../utils/queryValidation';
import { toJS } from 'mobx';
import SectionCard from '../../layout/SectionCard';
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
    const [runFilterMode, setRunFilterMode] = useState('passed');
    const [enableRunStepStatusFilter, setEnableRunStepStatusFilter] = useState(false);
    const [runStepFilterMode, setRunStepFilterMode] = useState('passed');
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
        setSelectedFields((currentFields) =>
          (currentFields || []).filter((field) => {
            const key = typeof field === 'string' ? field : field?.key;
            return !(typeof key === 'string' && key.endsWith('@linked'));
          })
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
            testAssociatedTree: acquiredTrees.testAssociatedTree ? [acquiredTrees.testAssociatedTree] : [],
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
        const testPlan = store.testPlansList.find((testPlan) => testPlan.id === dataToSave.testPlanId);
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
        const makeOption = (s) => (s ? { ...s, key: s.id, text: `${s.name} - (${s.id})` } : null);

        if (Array.isArray(dataToSave?.nonRecursiveTestSuiteIdList) && dataToSave.nonRecursiveTestSuiteIdList.length > 0) {
          const validTestSuites = dataToSave.nonRecursiveTestSuiteIdList
            .map((suiteId) => testSuiteList.find((suite) => suite.id === suiteId))
            .filter(Boolean)
            .map(makeOption)
            .filter(Boolean);

          setSelectedTestSuites(validTestSuites);
        } else if (Array.isArray(dataToSave?.testSuiteArray) && dataToSave.testSuiteArray.length > 0) {
          // Fallback: if only recursive list is present, map those (UI shows non-recursive selection only)
          const fromRecursive = dataToSave.testSuiteArray
            .map((suiteId) => testSuiteList.find((suite) => suite.id === suiteId))
            .filter(Boolean)
            .map(makeOption)
            .filter(Boolean);
          // Deduplicate by key
          const byKey = new Map(fromRecursive.map((s) => [s.key, s]));
          setSelectedTestSuites(Array.from(byKey.values()));
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
      const savedRunFilterMode = dataToSave?.runFilterMode;
      const savedRunStepFilterMode = dataToSave?.runStepFilterMode;
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
      if (savedRunFilterMode) {
        setRunFilterMode(savedRunFilterMode);
      }
      if (savedRunStepFilterMode) {
        setRunStepFilterMode(savedRunStepFilterMode);
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
            [store.sharedQueries.acquiredTrees.testAssociatedTree],
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
        // 1) Apply test plan and fetch its suites
        await processTestPlanSelection(dataToSave);

        // 2) Wait until suites for the selected plan are loaded, then apply saved suite selections
        const start = Date.now();
        const timeoutMs = 7000;
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        while (
          store.loadingState?.testSuiteListLoading ||
          !Array.isArray(store.testSuiteList) ||
          store.testSuiteList.length === 0
        ) {
          if (Date.now() - start > timeoutMs) break;
          await sleep(50);
        }
        processTestSuiteSelections(dataToSave);

        // 3) Restore selected fields, filters and queries
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

    // Validation: Both Test plan and at least one test suite must be selected
    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!selectedTestPlan?.key) {
        isValid = false;
        message = 'Select a test plan';
      } else if (!Array.isArray(selectedTestSuites) || selectedTestSuites.length === 0) {
        isValid = false;
        message = 'Select at least one test suite';
      }
      try {
        store.setValidationState(contentControlIndex, 'testReporter', { isValid, message });
        // Clear any pre-seeded init invalid flag for this control
        store.clearValidationForIndex(contentControlIndex, 'init');
      } catch {
        /* empty */
      }
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'testReporter');
        } catch {
          /* empty */
        }
      };
    }, [selectedTestPlan?.key, selectedTestSuites, store, contentControlIndex]);

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
              runFilterMode,
              runStepFilterMode,
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
      runStepFilterMode,
      contentControlIndex,
      enableRunTestCaseFilter,
      runFilterMode,
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

    // const loadingQueries = store.fetchLoadingState().sharedQueriesLoadingState;
    // const scopeSummaryParts = [];
    // if (selectedTestPlan?.text) scopeSummaryParts.push(`Plan: ${selectedTestPlan.text}`);
    // scopeSummaryParts.push(
    //   selectedTestSuites?.length
    //     ? `${selectedTestSuites.length} suite${selectedTestSuites.length === 1 ? '' : 's'} selected`
    //     : 'All suites included'
    // );

    // const linkedSummaryLabel =
    //   linkedQueryRequest.linkedQueryMode === 'query'
    //     ? `Query: ${
    //         linkedQueryRequest.testAssociatedQuery?.value ||
    //         linkedQueryRequest.testAssociatedQuery?.text ||
    //         linkedQueryRequest.testAssociatedQuery?.title ||
    //         'Not selected'
    //       }`
    //     : linkedQueryRequest.linkedQueryMode === 'linked'
    //     ? 'Include linked work items'
    //     : 'Linked items disabled';

    // const filterSummary = [
    //   allowGrouping ? 'Grouping enabled' : null,
    //   allowCrossTestPlan ? 'Cross-plan enabled' : null,
    //   enableRunTestCaseFilter ? `Run filter: ${runFilterMode}` : null,
    //   enableRunStepStatusFilter ? `Step filter: ${runStepFilterMode}` : null,
    //   errorFilterMode !== 'none' ? `Error filter: ${errorFilterMode}` : null,
    //   linkedSummaryLabel,
    // ].filter(Boolean);

    return (
      <Collapse
        in={selectedTeamProject?.key !== ''}
        timeout='auto'
        unmountOnExit
      >
        <Stack
          spacing={1.5}
          sx={{ my: 1 }}
        >
          <SectionCard
            title='Scope'
            description='Choose the test plan and suites to include in this report.'
          >
            <Grid
              container
              spacing={1.25}
              alignItems='flex-start'
            >
              <Grid
                size={{ xs: 12, md: 5 }}
                sx={{ minWidth: 0 }}
              >
                <SmartAutocomplete
                  size='small'
                  disableClearable
                  autoHighlight
                  openOnFocus
                  loading={store.loadingState.testPlanLoadingState}
                  options={store.testPlansList.map((testPlan) => ({
                    key: testPlan.id,
                    text: testPlan.name,
                  }))}
                  label='Test plan'
                  textFieldProps={{
                    size: 'small',
                    sx: {
                      '& .MuiInputBase-root': { minHeight: 56 },
                    },
                  }}
                  onChange={async (_event, newValue) => {
                    await handleTestPlanChanged(newValue);
                  }}
                  value={selectedTestPlan}
                />
              </Grid>
              <Grid
                size={{ xs: 12, md: 7 }}
                sx={{ minWidth: 0 }}
              >
                <SmartAutocomplete
                  multiple
                  size='small'
                  options={
                    selectedTestPlan?.key
                      ? (store.testSuiteList || []).map((s) => ({
                          ...s,
                          key: s.id,
                          text: `${s.name} - (${s.id})`,
                        }))
                      : []
                  }
                  loading={store.loadingState.testSuiteListLoading}
                  disableCloseOnSelect
                  autoHighlight
                  groupBy={(option) => {
                    const parent = suiteById.get(option.parent);
                    return parent ? `Parent: ${parent.name}` : 'Top Level';
                  }}
                  label='Test suites (descendants auto-included)'
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
          </SectionCard>

          <SectionCard
            title='Execution filters'
            description='Limit runs and highlight failures before exporting.'
          >
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={{ xs: 1.25, md: 2 }}
              >
                <Stack
                  spacing={0.75}
                  sx={{ flex: 1 }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size='small'
                        checked={allowGrouping}
                        onChange={(_event, checked) => {
                          setAllowGrouping(checked);
                        }}
                      />
                    }
                    label='Group results by suite'
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size='small'
                        checked={allowCrossTestPlan}
                        onChange={(_event, checked) => {
                          setAllowCrossTestPlan(checked);
                        }}
                      />
                    }
                    label='Include runs from other test plans'
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size='small'
                        checked={enableRunTestCaseFilter}
                        onChange={(_event, checked) => {
                          setEnableRunTestCaseFilter(checked);
                        }}
                      />
                    }
                    label='Only include executed test cases'
                  />
                  <Collapse
                    in={enableRunTestCaseFilter}
                    timeout='auto'
                    unmountOnExit
                  >
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ pl: 4 }}
                    >
                      Unexecuted test cases are filtered out of the export.
                    </Typography>
                  </Collapse>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size='small'
                        checked={enableRunStepStatusFilter}
                        onChange={(_event, checked) => {
                          setEnableRunStepStatusFilter(checked);
                        }}
                      />
                    }
                    label='Only include executed steps'
                  />
                  <Collapse
                    in={enableRunStepStatusFilter}
                    timeout='auto'
                    unmountOnExit
                  >
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ pl: 4 }}
                    >
                      Steps without execution results are skipped.
                    </Typography>
                  </Collapse>
                </Stack>

                <Stack
                  spacing={0.75}
                  sx={{ flex: 1 }}
                >
                  <Typography
                    id='error-filter-mode-label'
                    variant='subtitle2'
                  >
                    Error filter mode
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                  >
                    Keep only the runs that failed at the selected level.
                  </Typography>
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
                      label='Test case level'
                      control={<Radio size='small' />}
                    />
                    <FormControlLabel
                      value='onlyTestStepsResult'
                      label='Step level'
                      control={<Radio size='small' />}
                    />
                    <FormControlLabel
                      value='both'
                      label='Both levels'
                      control={<Radio size='small' />}
                    />
                  </RadioGroup>
                </Stack>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard
            title='Linked items'
            description='Choose how related work items should be pulled in.'
            loading={store.fetchLoadingState().sharedQueriesLoadingState}
            loadingText='Loading queries...'
          >
            <Stack spacing={1.25}>
              <Stack spacing={0.75}>
                <Typography
                  id='linked-item-query-group-label'
                  variant='subtitle2'
                >
                  Linked item mode
                </Typography>
                <Typography
                  variant='caption'
                  color='text.secondary'
                >
                  Include linked work items directly or drive them from a query.
                </Typography>
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
                      store.fetchLoadingState().sharedQueriesLoadingState ||
                      !queryTrees.testAssociatedTree ||
                      queryTrees.testAssociatedTree.length === 0
                    }
                  />
                </RadioGroup>
              </Stack>
              <Collapse
                in={linkedQueryRequest.linkedQueryMode === 'query'}
                timeout='auto'
                unmountOnExit
              >
                <Box sx={{ mt: 1 }}>
                  <QueryTree
                    data={queryTrees.testAssociatedTree}
                    prevSelectedQuery={linkedQueryRequest.testAssociatedQuery}
                    onSelectedQuery={onQuerySelected}
                    queryType={'test-associated'}
                    isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                  />
                </Box>
              </Collapse>
            </Stack>
          </SectionCard>

          <SectionCard
            title='Columns'
            description='Pick which fields appear in the exported spreadsheet.'
          >
            <Stack spacing={1.25}>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {selectedFields.length
                  ? `${selectedFields.length} field${selectedFields.length === 1 ? '' : 's'} selected`
                  : 'No fields selected yet. Move fields to the list on the right.'}
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
                  height: 240,
                }}
                listHeight={260}
                dataSource={fieldsToSelect}
                targetKeys={selectedFields}
                render={(item) => item.text}
                onChange={(nextTargetKeys) => {
                  setSelectedFields(nextTargetKeys);
                }}
                titles={['Available fields', 'Selected fields']}
                filterOption={(input, option) => option.text.toLowerCase().includes(input.toLowerCase())}
              />
            </Stack>
          </SectionCard>
        </Stack>
      </Collapse>
    );
  }
);

export default TestReporterSelector;
