import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Transfer, Upload } from 'antd';
import { DeleteOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  Grid,
  IconButton,
  Tab,
  Tabs,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import SmartAutocomplete from '../SmartAutocomplete';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';
import TocReminderToast from '../customToasts/TocReminderToast';
import QueryTree from '../QueryTree';
import { validateQuery } from '../../../utils/queryValidation';
import { toJS } from 'mobx';
import SectionCard from '../../layout/SectionCard';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import RestoreBackdrop from '../RestoreBackdrop';
import { suiteIdCollection, waitForSuites } from '../../../utils/sessionPersistence';

/**
 * TestReporterSelector
 * Manages test plan/suites, fields, filters, and linked query with session/favorite restore.
 */
const defaultItem = {
  key: '',
  text: '',
};
const defaultSelectedQueries = {
  linkedQueryMode: 'none',
  testAssociatedQuery: null,
  includeCommonColumnsMode: 'both',
};

const isMewpProjectName = (selectedTeamProject) => {
  if (typeof selectedTeamProject === 'string') {
    return selectedTeamProject.trim().toLowerCase() === 'mewp';
  }
  const projectName =
    selectedTeamProject?.text || selectedTeamProject?.name || selectedTeamProject?.key || '';
  return String(projectName).trim().toLowerCase() === 'mewp';
};

const REL_PATTERN = /(?:^|[^a-z0-9])rel\s*([0-9]+)/i;
const hasRelNumber = (value) => REL_PATTERN.test(String(value || ''));
const getFileDisplayName = (fileItem) =>
  String(fileItem?.name || fileItem?.objectName || fileItem?.text || '')
    .split('/')
    .pop()
    .trim();

const buildExternalValidationMessage = (result) => {
  if (!result || result.valid !== false) return '';
  const parts = [];
  const bugsMessage = String(result?.bugs?.message || '').trim();
  const l3l4Message = String(result?.l3l4?.message || '').trim();
  if (bugsMessage) parts.push(`Bugs file: ${bugsMessage}`);
  if (l3l4Message) parts.push(`L3/L4 file: ${l3l4Message}`);
  if (parts.length > 0) return parts.join(' | ');
  return 'External source files are invalid';
};

const resolveExternalTableValidationDetails = (validationState, tableType) => {
  const details = validationState?.details;
  if (!details || typeof details !== 'object') return null;
  if (details?.[tableType] && typeof details[tableType] === 'object') {
    return details[tableType];
  }
  if (details?.details?.[tableType] && typeof details.details[tableType] === 'object') {
    return details.details[tableType];
  }
  return null;
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
    const [includeAllHistory, setIncludeAllHistory] = useState(false);
    const [reportMode, setReportMode] = useState('regular');
    const [includeMewpL2Coverage, setIncludeMewpL2Coverage] = useState(false);
    const [includeInternalValidationReport, setIncludeInternalValidationReport] = useState(false);
    const [mergeDuplicateL2Cells, setMergeDuplicateL2Cells] = useState(false);
    const [externalBugsFile, setExternalBugsFile] = useState(null);
    const [externalL3L4File, setExternalL3L4File] = useState(null);
    const [externalSourcesBusy, setExternalSourcesBusy] = useState(false);
    const [externalValidationState, setExternalValidationState] = useState({
      status: 'idle',
      message: '',
      details: null,
    });
    const isMewpProject = useMemo(
      () => isMewpProjectName(selectedTeamProject),
      [selectedTeamProject]
    );
    const showMewpViews = isMewpProject;
    const isMewpCoverageMode = showMewpViews && reportMode === 'mewpStandalone';
    const availableTestPlans = useMemo(() => store.testPlansList || [], [store.testPlansList]);
    const suiteSource = useMemo(() => store.testSuiteList || [], [store.testSuiteList]);

    // isRestoring/restoreReady provided by useTabStatePersistence
    const savedDataRef = useRef(null);

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
      setIncludeMewpL2Coverage(isMewpProject);
    }, [isMewpProject]);

    useEffect(() => {
      if (!showMewpViews) {
        setIncludeInternalValidationReport(false);
        setMergeDuplicateL2Cells(false);
        setReportMode('regular');
      }
    }, [showMewpViews]);

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
      (suiteSource || []).forEach((s) => map.set(s.id, s));
      return map;
    }, [suiteSource]);

    const suiteOptions = useMemo(() => {
      if (!selectedTestPlan?.key) return [];
      return (suiteSource || []).map((s) => ({
        ...s,
        key: s.id,
        text: `${s.name} - (${s.id})`,
      }));
    }, [selectedTestPlan?.key, suiteSource]);

    const isRelSuiteOption = useCallback(
      (suiteOption) => {
        if (!suiteOption) return false;
        let cursor = suiteOption;
        const visited = new Set();
        while (cursor && !visited.has(cursor.id)) {
          visited.add(cursor.id);
          if (hasRelNumber(cursor.name) || hasRelNumber(cursor.text)) {
            return true;
          }
          cursor = suiteById.get(cursor.parent);
        }
        return false;
      },
      [suiteById]
    );

    const visibleSuiteOptions = useMemo(() => {
      if (!isMewpCoverageMode) return suiteOptions;
      return suiteOptions.filter((suite) => isRelSuiteOption(suite));
    }, [isMewpCoverageMode, suiteOptions, isRelSuiteOption]);

    const allSuitesSelected = useMemo(() => {
      if (!visibleSuiteOptions.length) return false;
      const selectedKeys = new Set((selectedTestSuites || []).map((suite) => suite?.key));
      if (selectedKeys.size < visibleSuiteOptions.length) return false;
      return visibleSuiteOptions.every((suite) => selectedKeys.has(suite.key));
    }, [visibleSuiteOptions, selectedTestSuites]);

    const suiteSelectionSummary = useMemo(() => {
      if (!selectedTestPlan?.key) return 'Select a test plan to see suites';
      if (store.loadingState?.testSuiteListLoading) return 'Loading suites...';
      if (!visibleSuiteOptions.length) {
        return isMewpCoverageMode
          ? 'No Rel suites available for this plan'
          : 'No suites available for this plan';
      }
      if (allSuitesSelected) return `All ${visibleSuiteOptions.length} suites selected`;
      const selectedCount = Array.isArray(selectedTestSuites) ? selectedTestSuites.length : 0;
      return selectedCount
        ? `${selectedCount} of ${visibleSuiteOptions.length} suites selected`
        : `${visibleSuiteOptions.length} suites available`;
    }, [
      selectedTestPlan?.key,
      store.loadingState?.testSuiteListLoading,
      visibleSuiteOptions.length,
      allSuitesSelected,
      selectedTestSuites,
      isMewpCoverageMode,
    ]);

    const handleTestPlanChanged = useCallback(
      async (newValue) => {
        if (!newValue?.key) {
          setSelectedTestPlan(defaultItem);
          setSelectedTestSuites([]);
          return;
        }
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

    const handleSelectAllSuitesToggle = useCallback(
      (_event, checked) => {
        if (!selectedTestPlan?.key) return;
        if (checked) {
          setSelectedTestSuites(visibleSuiteOptions);
        } else {
          setSelectedTestSuites([]);
        }
      },
      [selectedTestPlan?.key, visibleSuiteOptions]
    );

    useEffect(() => {
      if (!isMewpCoverageMode) return;
      setSelectedTestSuites((prev) => (prev || []).filter((suite) => isRelSuiteOption(suite)));
    }, [isMewpCoverageMode, isRelSuiteOption]);

    const processTestPlanSelection = useCallback(
      async (dataToSave) => {
        const testPlanId = dataToSave?.testPlanId;
        if (!testPlanId) return;
        const testPlan = availableTestPlans.find((testPlan) => testPlan.id === testPlanId);
        if (!testPlan) {
          toast.warn(`Test plan with ID ${testPlanId} not found`);
          return;
        }
        await handleTestPlanChanged({ key: testPlanId, text: testPlan.name });
      },
      [availableTestPlans, handleTestPlanChanged]
    );

    const processTestSuiteSelections = useCallback(
      (dataToSave) => {
        const testSuiteList = suiteSource;
        const makeOption = (s) => (s ? { ...s, key: s.id, text: `${s.name} - (${s.id})` } : null);

        if (
          Array.isArray(dataToSave?.nonRecursiveTestSuiteIdList) &&
          dataToSave.nonRecursiveTestSuiteIdList.length > 0
        ) {
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
      [suiteSource]
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
      const savedIncludeAllHistory = dataToSave?.includeAllHistory;
      const savedIncludeMewpL2Coverage = dataToSave?.includeMewpL2Coverage;
      const savedIncludeInternalValidationReport = dataToSave?.includeInternalValidationReport;
      const savedMergeDuplicateL2Cells = dataToSave?.mergeDuplicateL2Cells;
      const savedReportMode = dataToSave?.reportMode;
      const savedExternalBugsFile = dataToSave?.externalBugsFile;
      const savedExternalL3L4File = dataToSave?.externalL3L4File;
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
      if (savedIncludeAllHistory !== undefined) {
        setIncludeAllHistory(!!savedIncludeAllHistory);
      }
      if (savedIncludeMewpL2Coverage !== undefined) {
        setIncludeMewpL2Coverage(!!savedIncludeMewpL2Coverage);
      }
      if (savedIncludeInternalValidationReport !== undefined) {
        setIncludeInternalValidationReport(!!savedIncludeInternalValidationReport);
      }
      if (savedMergeDuplicateL2Cells !== undefined) {
        setMergeDuplicateL2Cells(!!savedMergeDuplicateL2Cells);
      }
      if (savedReportMode && showMewpViews && ['regular', 'mewpStandalone'].includes(savedReportMode)) {
        setReportMode(savedReportMode);
      }
      if (savedExternalBugsFile) {
        setExternalBugsFile(savedExternalBugsFile);
      } else {
        setExternalBugsFile(null);
      }
      if (savedExternalL3L4File) {
        setExternalL3L4File(savedExternalL3L4File);
      } else {
        setExternalL3L4File(null);
      }
    }, [showMewpViews]);

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

    const applySavedData = useCallback(
      async (dataToSave) => {
        // 1) Apply test plan and fetch its suites
        await processTestPlanSelection(dataToSave);

        // 2) Wait until suites for the selected plan are loaded, then apply saved suite selections
        const hasPlan =
          !!dataToSave?.testPlanId &&
          Array.isArray(store.testPlansList) &&
          !!store.testPlansList.find((p) => p.id === dataToSave.testPlanId);
        if (hasPlan) {
          try {
            await waitForSuites(store, 7000);
          } catch {
            /* empty */
          }
        }
        processTestSuiteSelections(dataToSave);

        // 3) Restore selected fields, filters and queries
        processSavedFields(dataToSave);
        processFilters(dataToSave);
        processSavedQueries(dataToSave.linkedQueryRequest);

        savedDataRef.current = dataToSave;
      },
      [
        processFilters,
        processSavedFields,
        processTestPlanSelection,
        processTestSuiteSelections,
        processSavedQueries,
        store,
      ]
    );

    const resetLocalState = useCallback(() => {
      setSelectedTestPlan(defaultItem);
      setSelectedTestSuites([]);
      setAllowCrossTestPlan(false);
      setErrorFilterMode('none');
      setAllowGrouping(false);
      setEnableRunTestCaseFilter(false);
      setRunFilterMode('passed');
      setEnableRunStepStatusFilter(false);
      setRunStepFilterMode('passed');
      setSelectedFields([]);
      setLinkedQueryRequest(defaultSelectedQueries);
      setIncludeAllHistory(false);
      setReportMode('regular');
      setIncludeMewpL2Coverage(false);
      setIncludeInternalValidationReport(false);
      setMergeDuplicateL2Cells(false);
      setExternalBugsFile(null);
      setExternalL3L4File(null);
      savedDataRef.current = null;
    }, []);

    const hasHistorySelected = useMemo(
      () => (selectedFields || []).includes('System.History@testCaseWorkItemField'),
      [selectedFields]
    );

    const { isRestoring, restoreReady } = useTabStatePersistence({
      store,
      contentControlIndex,
      applySavedData,
      resetLocalState,
    });

    useEffect(() => {
      if (isRestoring || !restoreReady) return;
      if (!hasHistorySelected && includeAllHistory) {
        setIncludeAllHistory(false);
      }
    }, [hasHistorySelected, includeAllHistory, isRestoring, restoreReady]);

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
      } else if (isMewpCoverageMode && (externalBugsFile || externalL3L4File)) {
        if (externalValidationState.status === 'validating') {
          isValid = false;
          message = 'Validating external source files...';
        } else if (externalValidationState.status === 'invalid') {
          isValid = false;
          message = externalValidationState.message || 'External source files are invalid';
        }
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
    }, [
      selectedTestPlan?.key,
      selectedTestSuites,
      store,
      contentControlIndex,
      isMewpCoverageMode,
      externalBugsFile,
      externalL3L4File,
      externalValidationState.status,
      externalValidationState.message,
    ]);

    useEffect(() => {
      const updateTestReporterRequestObject = () => {
        let testSuiteIdList = undefined;
        let nonRecursiveTestSuiteIdList = undefined;
        const { testSuiteArray, nonRecursiveTestSuiteIdList: nonRec } = suiteIdCollection(
          selectedTestSuites,
          store
        );
        testSuiteIdList = testSuiteArray;
        nonRecursiveTestSuiteIdList = nonRec;

        const sharedData = {
          testPlanId: selectedTestPlan.key,
          testPlanText: selectedTestPlan.text || '',
          testSuiteArray: testSuiteIdList,
          testSuiteTextList: Array.isArray(selectedTestSuites)
            ? selectedTestSuites
                .map((s) => s?.text || s?.name || String(s?.id ?? s?.key ?? ''))
                .filter(Boolean)
            : [],
          nonRecursiveTestSuiteIdList: nonRecursiveTestSuiteIdList,
          includeInternalValidationReport: showMewpViews ? includeInternalValidationReport : false,
          mergeDuplicateL2Cells: showMewpViews ? mergeDuplicateL2Cells : false,
          reportMode,
        };

        if (isMewpCoverageMode) {
          addToDocumentRequestObject(
            {
              type: 'mewpStandaloneReporter',
              title: 'mewp-standalone-l2-implementation-content-control',
              skin: 'testReporter',
              data: {
                ...sharedData,
                useRelFallback: true,
                linkedQueryRequest,
                externalBugsFile,
                externalL3L4File,
              },
              isExcelSpreadsheet: true,
            },
            contentControlIndex
          );
          return;
        }

        addToDocumentRequestObject(
          {
            type: 'testReporter',
            title: 'test-reporter-content-control',
            skin: 'testReporter',
            data: {
              ...sharedData,
              allowCrossTestPlan: allowCrossTestPlan,
              enableRunTestCaseFilter: enableRunTestCaseFilter,
              enableRunStepStatusFilter: enableRunStepStatusFilter,
              runFilterMode,
              runStepFilterMode,
              errorFilterMode: errorFilterMode,
              allowGrouping: allowGrouping,
              selectedFields: selectedFields,
              linkedQueryRequest: linkedQueryRequest,
              includeAllHistory,
              includeMewpL2Coverage: showMewpViews ? includeMewpL2Coverage : false,
            },
            isExcelSpreadsheet: true,
          },
          contentControlIndex
        );
      };
      if (!isRestoring && restoreReady) {
        updateTestReporterRequestObject();
      }
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
      includeAllHistory,
      includeMewpL2Coverage,
      includeInternalValidationReport,
      mergeDuplicateL2Cells,
      reportMode,
      isMewpProject,
      showMewpViews,
      isMewpCoverageMode,
      externalBugsFile,
      externalL3L4File,
      isRestoring,
      restoreReady,
      store,
      selectedTestPlan.text,
    ]);

    // Re-apply query-dependent parts when shared queries arrive
    useEffect(() => {
      if (!savedDataRef.current) return;
      if (!store?.sharedQueries?.acquiredTrees) return;
      processSavedQueries(savedDataRef.current.linkedQueryRequest);
    }, [store.sharedQueries, processSavedQueries]);

    const onQuerySelected = useCallback((query) => {
      setLinkedQueryRequest((prev) => ({ ...prev, testAssociatedQuery: query }));
    }, []);

    useEffect(() => {
      if (!isMewpCoverageMode) return;
      if (linkedQueryRequest.linkedQueryMode !== 'linked') return;
      setLinkedQueryRequest((prev) => ({ ...prev, linkedQueryMode: 'none' }));
    }, [isMewpCoverageMode, linkedQueryRequest.linkedQueryMode]);

    const handleLinkedQueryChange = (value) => {
      if (value === 'query') {
        setLinkedQueryRequest((prev) => ({ ...prev, linkedQueryMode: value }));
      } //In case of None or Linked requirement
      else {
        setLinkedQueryRequest({ ...defaultSelectedQueries, linkedQueryMode: value });
        if (value === 'linked') {
          toast.info(
            <TocReminderToast
              icon='🔗'
              title='Linked mode enabled'
              description='To include related work items in your export, add these columns to your selection:'
              items={['Associated Requirement', 'Associated Bug', 'Associated CR']}
              tip='Find them in the Columns panel. Without these columns, linked items will not be fetched.'
              tipIcon='💡'
            />,
            { autoClose: 8000, closeOnClick: true }
          );
        }
      }
    };

    const validateMewpExternalSources = useCallback(
      async (bugsFileRef, l3l4FileRef, { silent = false } = {}) => {
        const hasSources = !!bugsFileRef || !!l3l4FileRef;
        if (!isMewpCoverageMode || !hasSources) {
          setExternalValidationState({ status: 'idle', message: '', details: null });
          return { valid: true };
        }
        try {
          setExternalValidationState({ status: 'validating', message: '', details: null });
          const response = await store.validateMewpExternalIngestionFiles({
            externalBugsFile: bugsFileRef || null,
            externalL3L4File: l3l4FileRef || null,
          });
          if (response?.valid) {
            setExternalValidationState({ status: 'valid', message: '', details: response });
            if (!silent) {
              toast.success('External source files are valid');
            }
            return response;
          }
          const message = buildExternalValidationMessage(response);
          setExternalValidationState({ status: 'invalid', message, details: response });
          if (!silent) {
            toast.error(message, { autoClose: false });
          }
          return response;
        } catch (error) {
          const message = String(error?.message || error || '').trim() || 'External source validation failed';
          setExternalValidationState({
            status: 'invalid',
            message,
            details: error?.details || null,
          });
          if (!silent) {
            toast.error(message, { autoClose: false });
          }
          return { valid: false };
        }
      },
      [isMewpCoverageMode, store]
    );

    const restoreLatestExternalByType = useCallback(
      async (docType, { silent = false } = {}) => {
        const normalized = String(docType || '').trim().toLowerCase();
        if (!['bugs', 'l3l4'].includes(normalized)) return null;
        try {
          const latest = await store.getLatestMewpExternalIngestionFile(normalized, { mineOnly: true });
          if (latest) {
            if (normalized === 'bugs') {
              setExternalBugsFile(latest);
            } else {
              setExternalL3L4File(latest);
            }
            const nextBugs = normalized === 'bugs' ? latest : externalBugsFile;
            const nextL3L4 = normalized === 'l3l4' ? latest : externalL3L4File;
            await validateMewpExternalSources(nextBugs, nextL3L4, { silent: true });
            if (!silent) {
              toast.success(`Loaded your latest ${normalized.toUpperCase()} source from bucket`);
            }
            return latest;
          }
          if (!silent) {
            toast.info(`No ${normalized.toUpperCase()} source found for your user`);
          }
          return null;
        } catch (error) {
          if (!silent) {
            toast.error(`Failed loading ${normalized.toUpperCase()} source: ${error?.message || error}`);
          }
          return null;
        }
      },
      [store, externalBugsFile, externalL3L4File, validateMewpExternalSources]
    );

    useEffect(() => {
      if (!isMewpCoverageMode || !store.teamProjectName) return;
      let cancelled = false;
      const restoreFromBucket = async () => {
        setExternalSourcesBusy(true);
        try {
          const [bugs, l3l4] = await Promise.all([
            store.getLatestMewpExternalIngestionFile('bugs', { mineOnly: true }),
            store.getLatestMewpExternalIngestionFile('l3l4', { mineOnly: true }),
          ]);
          if (cancelled) return;
          if (!externalBugsFile && bugs) {
            setExternalBugsFile(bugs);
          }
          if (!externalL3L4File && l3l4) {
            setExternalL3L4File(l3l4);
          }
        } catch {
          // keep UI usable even if auto-recovery fails
        } finally {
          if (!cancelled) {
            setExternalSourcesBusy(false);
          }
        }
      };
      restoreFromBucket();
      return () => {
        cancelled = true;
      };
    }, [isMewpCoverageMode, store, store.teamProjectName, externalBugsFile, externalL3L4File]);

    useEffect(() => {
      if (!isMewpCoverageMode) {
        setExternalValidationState({ status: 'idle', message: '', details: null });
        return;
      }
      if (!externalBugsFile && !externalL3L4File) {
        setExternalValidationState({ status: 'idle', message: '', details: null });
        return;
      }
      validateMewpExternalSources(externalBugsFile, externalL3L4File, { silent: true });
    }, [isMewpCoverageMode, externalBugsFile, externalL3L4File, validateMewpExternalSources]);

    const uploadExternalMewpSource = useCallback(
      async (file, docType, onSuccess) => {
        const normalizedType = String(docType || '').trim().toLowerCase();
        const lower = String(file?.name || '').toLowerCase();
        const isSupported = lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
        if (!isSupported) {
          toast.error('Only CSV/XLS/XLSX files are supported');
          return Upload.LIST_IGNORE;
        }
        try {
          setExternalSourcesBusy(true);
          const existingByName = await store.findMewpExternalIngestionFileByName(
            normalizedType,
            file?.name,
            { mineOnly: true }
          );
          if (existingByName) {
            onSuccess(existingByName);
            const nextBugs = normalizedType === 'bugs' ? existingByName : externalBugsFile;
            const nextL3L4 = normalizedType === 'l3l4' ? existingByName : externalL3L4File;
            await validateMewpExternalSources(nextBugs, nextL3L4, { silent: true });
            toast.info(
              `Using existing ${normalizedType.toUpperCase()} source from bucket (${getFileDisplayName(
                existingByName
              )})`
            );
            return false;
          }

          const response = await store.uploadFile(
            file,
            store.getMewpExternalIngestionBucketName(),
            {
              docTypeOverride: normalizedType,
              purpose: 'mewpExternalIngestion',
            }
          );
          const fileItem = response?.data?.fileItem;
          if (!fileItem?.url) {
            throw new Error('Upload completed without a file URL');
          }
          onSuccess(fileItem);
          const nextBugs = normalizedType === 'bugs' ? fileItem : externalBugsFile;
          const nextL3L4 = normalizedType === 'l3l4' ? fileItem : externalL3L4File;
          await validateMewpExternalSources(nextBugs, nextL3L4, { silent: true });
          toast.success(`Uploaded ${file.name}`);
        } catch (error) {
          toast.error(`Failed to upload ${file.name}: ${error?.message || error}`, { autoClose: false });
        } finally {
          setExternalSourcesBusy(false);
        }
        return false;
      },
      [store, externalBugsFile, externalL3L4File, validateMewpExternalSources]
    );

    const deleteExternalMewpSource = useCallback(
      async (docType, fileItem, onClear) => {
        if (!fileItem) return;
        try {
          setExternalSourcesBusy(true);
          if (fileItem?.etag) {
            await store.deleteMewpExternalIngestionFile(fileItem);
          }
          onClear();
          const normalized = String(docType || '').trim().toLowerCase();
          const nextBugs = normalized === 'bugs' ? null : externalBugsFile;
          const nextL3L4 = normalized === 'l3l4' ? null : externalL3L4File;
          await validateMewpExternalSources(nextBugs, nextL3L4, { silent: true });
          toast.success(`${String(docType || '').toUpperCase()} source deleted`);
        } catch (error) {
          toast.error(`Failed deleting ${String(docType || '').toUpperCase()} source: ${error?.message || error}`);
        } finally {
          setExternalSourcesBusy(false);
        }
      },
      [store, externalBugsFile, externalL3L4File, validateMewpExternalSources]
    );

    const createExternalUploadProps = useCallback(
      (docType, onSuccess) => ({
        name: 'file',
        maxCount: 1,
        accept: '.csv,.xlsx,.xls',
        beforeUpload: async (file) => uploadExternalMewpSource(file, docType, onSuccess),
      }),
      [uploadExternalMewpSource]
    );

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

    const renderScopeSection = (standaloneMode = false) => (
      <SectionCard
        title='Scope'
        description={
          standaloneMode
            ? 'Choose the test plan and Rel suites for standalone MEWP reporting.'
            : 'Choose the test plan and suites to include in this report.'
        }
      >
        <Stack spacing={2}>
          <SmartAutocomplete
            size='small'
            disableClearable
            autoHighlight
            openOnFocus
            loading={store.loadingState.testPlanLoadingState}
            options={availableTestPlans.map((testPlan) => ({
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
          <Grid
            container
            spacing={1.5}
            alignItems='flex-start'
          >
            <Grid
              size={{ xs: 12, md: 10 }}
              sx={{ minWidth: 0 }}
            >
              <SmartAutocomplete
                multiple
                size='small'
                options={visibleSuiteOptions}
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
            <Grid
              size={{ xs: 12, md: 2 }}
              sx={{
                minWidth: 0,
                display: 'flex',
                alignItems: 'flex-start',
                pt: { xs: 0, md: 1.5 },
              }}
            >
              <Stack
                spacing={0.25}
                alignItems='flex-start'
                sx={{ width: '100%' }}
              >
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Switch
                      size='small'
                      checked={allSuitesSelected}
                      onChange={handleSelectAllSuitesToggle}
                      disabled={
                        !selectedTestPlan?.key ||
                        store.loadingState?.testSuiteListLoading ||
                        visibleSuiteOptions.length === 0
                      }
                    />
                  }
                  label={<Typography variant='body2'>Select all suites</Typography>}
                />
                <Typography
                  variant='caption'
                  color='text.secondary'
                >
                  {suiteSelectionSummary}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </SectionCard>
    );

    const renderStandaloneMewpQuerySection = () => (
      <SectionCard
        title='Requirement scope'
        description='Optionally limit MEWP coverage to requirements mapped by a selected query.'
        loading={store.fetchLoadingState().sharedQueriesLoadingState}
        loadingText='Loading queries...'
      >
        <Stack spacing={1.25}>
          <Stack spacing={0.75}>
            <Typography
              id='mewp-query-scope-label'
              variant='subtitle2'
            >
              Scope source
            </Typography>
            <Typography
              variant='caption'
              color='text.secondary'
            >
              Select a query to filter coverage scope, or keep None for full suite-derived scope.
            </Typography>
            <RadioGroup
              row
              name='mewp-query-scope-mode'
              aria-labelledby='mewp-query-scope-label'
              value={linkedQueryRequest.linkedQueryMode === 'query' ? 'query' : 'none'}
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
    );

    const modeSpecificSections = !isMewpCoverageMode ? (
      <>
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
            {hasHistorySelected ? (
              <Stack
                direction='row'
                spacing={0.5}
                alignItems='center'
              >
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Switch
                      size='small'
                      checked={includeAllHistory}
                      onChange={(_event, checked) => setIncludeAllHistory(checked)}
                    />
                  }
                  label={<Typography variant='body2'>Include all discussion history</Typography>}
                />
                <Tooltip title='Default: only the most recent comment is exported'>
                  <IconButton
                    size='small'
                    aria-label='Include all discussion history info'
                    sx={{ color: 'text.secondary' }}
                  >
                    <InfoOutlined fontSize='inherit' />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : null}
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
              filterOption={(input, option) =>
                option.text.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Stack>
        </SectionCard>
        {showMewpViews ? (
          <SectionCard
            title='L2 Coverage'
            description='MEWP-only: adds a parallel L2 coverage worksheet using the same plan and suites.'
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    size='small'
                    checked={includeMewpL2Coverage}
                    onChange={(_event, checked) => {
                      setIncludeMewpL2Coverage(checked);
                    }}
                  />
                }
                label='Include L2 coverage sheet'
              />
              <Typography
                variant='caption'
                color='text.secondary'
              >
                Regular Test Reporter output remains unchanged; this appends an additional sheet.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    size='small'
                    checked={includeInternalValidationReport}
                    onChange={(_event, checked) => {
                      setIncludeInternalValidationReport(checked);
                    }}
                  />
                }
                label='Generate standalone Internal Validation report (ZIP package)'
              />
            </Stack>
          </SectionCard>
        ) : null}
      </>
    ) : (
      <>
        {renderStandaloneMewpQuerySection()}
        <SectionCard
          title='Standalone MEWP Reports'
          description='Generates a standalone MEWP L2 report, with optional Internal Validation report, packaged as ZIP.'
        >
          <Stack spacing={1.5}>
            <Typography
              variant='caption'
              color='text.secondary'
            >
              Only Rel suites are supported in this mode. Latest selected Rel is used, with fallback to previous Rel when needed.
            </Typography>
            <Typography
              variant='caption'
              color='text.secondary'
            >
              Uploaded external sources are kept for 1 day. Recover reloads your latest file from bucket after refresh, and Delete removes it immediately.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size='small'
                  checked={includeInternalValidationReport}
                  onChange={(_event, checked) => setIncludeInternalValidationReport(checked)}
                />
              }
              label='Include Internal Validation report in ZIP'
            />
            <FormControlLabel
              control={
                <Checkbox
                  size='small'
                  checked={mergeDuplicateL2Cells}
                  onChange={(_event, checked) => setMergeDuplicateL2Cells(checked)}
                />
              }
              label='Merge duplicate L2 cells (layout hint)'
            />
            {externalValidationState.status === 'validating' ? (
              <Typography
                variant='caption'
                color='warning.main'
              >
                Validating external source files...
              </Typography>
            ) : null}
            {externalValidationState.status === 'invalid' ? (
              <Typography
                variant='caption'
                color='error.main'
              >
                {externalValidationState.message}
              </Typography>
            ) : null}
            {externalValidationState.status === 'valid' ? (
              <Typography
                variant='caption'
                color='success.main'
              >
                External source files passed schema validation.
              </Typography>
            ) : null}
            {(() => {
              const tableType = 'bugs';
              const title = 'Bugs table validation';
              const hasFile = !!externalBugsFile;
              const tableDetails = resolveExternalTableValidationDetails(externalValidationState, tableType);
              const missingColumns = Array.isArray(tableDetails?.missingRequiredColumns)
                ? tableDetails.missingRequiredColumns
                : [];
              const isValid = tableDetails?.valid === true;
              const isInvalid = tableDetails?.valid === false;
              const isValidating = externalValidationState.status === 'validating' && hasFile;
              const captionColor = isValidating
                ? 'warning.main'
                : isValid
                ? 'success.main'
                : isInvalid
                ? 'error.main'
                : 'text.secondary';

              return (
                <Stack
                  spacing={0.25}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                  }}
                >
                  <Typography variant='caption' sx={{ fontWeight: 600 }}>
                    {title}
                  </Typography>
                  {!hasFile ? (
                    <Typography variant='caption' color='text.secondary'>
                      No file provided.
                    </Typography>
                  ) : isValidating ? (
                    <Typography variant='caption' color='warning.main'>
                      Validation in progress...
                    </Typography>
                  ) : tableDetails ? (
                    <>
                      <Typography variant='caption' color={captionColor}>
                        {isValid ? 'Valid format' : 'Invalid format'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Header row: {tableDetails.headerRow || 'n/a'} | Matched columns:{' '}
                        {Number(tableDetails.matchedRequiredColumns || 0)}/
                        {Number(tableDetails.totalRequiredColumns || 0)} | Data rows:{' '}
                        {Number(tableDetails.rowCount || 0)}
                      </Typography>
                      {missingColumns.length > 0 ? (
                        <Typography variant='caption' color='error.main'>
                          Missing columns: {missingColumns.join(', ')}
                        </Typography>
                      ) : null}
                      {tableDetails.message ? (
                        <Typography variant='caption' color={isInvalid ? 'error.main' : 'text.secondary'}>
                          {tableDetails.message}
                        </Typography>
                      ) : null}
                    </>
                  ) : (
                    <Typography variant='caption' color='text.secondary'>
                      Validation details are not available yet.
                    </Typography>
                  )}
                </Stack>
              );
            })()}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <Typography
                variant='body2'
                sx={{ minWidth: { md: 180 } }}
              >
                External Bugs table (CSV/XLSX)
              </Typography>
              <Upload
                {...createExternalUploadProps(
                  'bugs',
                  (fileItem) => setExternalBugsFile(fileItem),
                )}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={externalSourcesBusy}
                >
                  Upload Bugs File
                </Button>
              </Upload>
              <Typography
                variant='caption'
                color='text.secondary'
              >
                {getFileDisplayName(externalBugsFile) || 'No file uploaded'}
              </Typography>
              <Stack
                direction='row'
                spacing={1}
              >
                <Button
                  size='small'
                  icon={<ReloadOutlined />}
                  onClick={() => restoreLatestExternalByType('bugs')}
                  loading={externalSourcesBusy}
                >
                  Recover Mine
                </Button>
                <Button
                  size='small'
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!externalBugsFile}
                  loading={externalSourcesBusy}
                  onClick={() =>
                    deleteExternalMewpSource('bugs', externalBugsFile, () =>
                      setExternalBugsFile(null)
                    )
                  }
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
            {(() => {
              const tableType = 'l3l4';
              const title = 'L3/L4 table validation';
              const hasFile = !!externalL3L4File;
              const tableDetails = resolveExternalTableValidationDetails(externalValidationState, tableType);
              const missingColumns = Array.isArray(tableDetails?.missingRequiredColumns)
                ? tableDetails.missingRequiredColumns
                : [];
              const isValid = tableDetails?.valid === true;
              const isInvalid = tableDetails?.valid === false;
              const isValidating = externalValidationState.status === 'validating' && hasFile;
              const captionColor = isValidating
                ? 'warning.main'
                : isValid
                ? 'success.main'
                : isInvalid
                ? 'error.main'
                : 'text.secondary';

              return (
                <Stack
                  spacing={0.25}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                  }}
                >
                  <Typography variant='caption' sx={{ fontWeight: 600 }}>
                    {title}
                  </Typography>
                  {!hasFile ? (
                    <Typography variant='caption' color='text.secondary'>
                      No file provided.
                    </Typography>
                  ) : isValidating ? (
                    <Typography variant='caption' color='warning.main'>
                      Validation in progress...
                    </Typography>
                  ) : tableDetails ? (
                    <>
                      <Typography variant='caption' color={captionColor}>
                        {isValid ? 'Valid format' : 'Invalid format'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Header row: {tableDetails.headerRow || 'n/a'} | Matched columns:{' '}
                        {Number(tableDetails.matchedRequiredColumns || 0)}/
                        {Number(tableDetails.totalRequiredColumns || 0)} | Data rows:{' '}
                        {Number(tableDetails.rowCount || 0)}
                      </Typography>
                      {missingColumns.length > 0 ? (
                        <Typography variant='caption' color='error.main'>
                          Missing columns: {missingColumns.join(', ')}
                        </Typography>
                      ) : null}
                      {tableDetails.message ? (
                        <Typography variant='caption' color={isInvalid ? 'error.main' : 'text.secondary'}>
                          {tableDetails.message}
                        </Typography>
                      ) : null}
                    </>
                  ) : (
                    <Typography variant='caption' color='text.secondary'>
                      Validation details are not available yet.
                    </Typography>
                  )}
                </Stack>
              );
            })()}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <Typography
                variant='body2'
                sx={{ minWidth: { md: 180 } }}
              >
                External L3/L4 table (CSV/XLSX)
              </Typography>
              <Upload
                {...createExternalUploadProps(
                  'l3l4',
                  (fileItem) => setExternalL3L4File(fileItem),
                )}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={externalSourcesBusy}
                >
                  Upload L3/L4 File
                </Button>
              </Upload>
              <Typography
                variant='caption'
                color='text.secondary'
              >
                {getFileDisplayName(externalL3L4File) || 'No file uploaded'}
              </Typography>
              <Stack
                direction='row'
                spacing={1}
              >
                <Button
                  size='small'
                  icon={<ReloadOutlined />}
                  onClick={() => restoreLatestExternalByType('l3l4')}
                  loading={externalSourcesBusy}
                >
                  Recover Mine
                </Button>
                <Button
                  size='small'
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!externalL3L4File}
                  loading={externalSourcesBusy}
                  onClick={() =>
                    deleteExternalMewpSource('l3l4', externalL3L4File, () =>
                      setExternalL3L4File(null)
                    )
                  }
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </SectionCard>
      </>
    );

    return (
      <>
        <Stack
          spacing={1.5}
          sx={{ my: 1 }}
        >
          {showMewpViews ? (
            <SectionCard
              title='Report Sub Tabs'
              description='Choose which report generation flow to configure.'
            >
              <Box
                sx={{
                  backgroundColor: 'grey.100',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  padding: 0.5,
                  maxWidth: 560,
                }}
              >
                <Tabs
                  value={reportMode}
                  onChange={(_event, value) => setReportMode(value)}
                  variant='fullWidth'
                  TabIndicatorProps={{ style: { display: 'none' } }}
                  sx={{
                    minHeight: 44,
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      minHeight: 44,
                      borderRadius: 1.5,
                      color: 'text.secondary',
                      fontWeight: 500,
                    },
                    '& .MuiTab-root.Mui-selected': {
                      backgroundColor: 'background.paper',
                      color: 'text.primary',
                      fontWeight: 600,
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.14)',
                    },
                  }}
                >
                  <Tab
                    value='regular'
                    label='Regular Test Reporter'
                  />
                  <Tab
                    value='mewpStandalone'
                    label='MEWP New Reports'
                  />
                </Tabs>
              </Box>
              <Stack
                spacing={1.5}
                sx={{ mt: 1.5 }}
              >
                {renderScopeSection(isMewpCoverageMode)}
                {modeSpecificSections}
              </Stack>
            </SectionCard>
          ) : (
            <>
              {renderScopeSection(false)}
              {modeSpecificSections}
            </>
          )}
          </Stack>
        <RestoreBackdrop
          open={!!isRestoring}
          label='Restoring Test Reporter selection…'
        />
      </>
    );
  }
);

export default TestReporterSelector;
