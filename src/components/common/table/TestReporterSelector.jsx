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
const isUiDebugModeEnabled = () => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('debug');
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
};
const getFileDisplayName = (fileItem) =>
  String(fileItem?.name || fileItem?.objectName || fileItem?.text || '')
    .split('/')
    .pop()
    .trim();
const isAtpReleasePlanName = (planName) => String(planName || '').trim().toLowerCase() === 'atp release';
const MEWP_EXTERNAL_VALIDATION_CACHE_PREFIX = 'mewpExternalValidationCache';
const EXTERNAL_VALIDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

const buildExternalValidationSignature = (fileItem) => {
  const bucket = String(fileItem?.bucketName || '').trim();
  const objectName = String(fileItem?.objectName || fileItem?.text || fileItem?.name || '').trim();
  const etag = String(fileItem?.etag || '').trim();
  const size = String(fileItem?.sizeBytes || '').trim();
  if (!bucket && !objectName && !etag && !size) return '';
  return [bucket, objectName, etag, size].join('|').toLowerCase();
};

const buildExternalValidationCacheKey = (projectName, tableType, signature) => {
  const normalizedProject = String(projectName || '').trim().toLowerCase() || 'unknown-project';
  return `${MEWP_EXTERNAL_VALIDATION_CACHE_PREFIX}:${normalizedProject}:${tableType}:${signature}`;
};

const readExternalValidationCache = (projectName, tableType, signature) => {
  try {
    if (!signature) return null;
    const key = buildExternalValidationCacheKey(projectName, tableType, signature);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const createdAt = Number(parsed?.createdAt || 0);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > EXTERNAL_VALIDATION_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    const details = parsed?.details;
    if (!details || details.valid !== true) return null;
    return details;
  } catch {
    return null;
  }
};

const writeExternalValidationCache = (projectName, tableType, signature, details) => {
  try {
    if (!signature || !details || details.valid !== true) return;
    const key = buildExternalValidationCacheKey(projectName, tableType, signature);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        createdAt: Date.now(),
        details,
      })
    );
  } catch {
    // no-op
  }
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
    const [mergeDuplicateRequirementCells, setMergeDuplicateRequirementCells] = useState(false);
    const [externalBugsFile, setExternalBugsFile] = useState(null);
    const [externalL3L4File, setExternalL3L4File] = useState(null);
    const [externalSourcesBusy, setExternalSourcesBusy] = useState(false);
    const [externalUploadResetVersion, setExternalUploadResetVersion] = useState({
      bugs: 0,
      l3l4: 0,
    });
    const [externalValidationState, setExternalValidationState] = useState({
      status: 'idle',
      message: '',
      details: null,
    });
    const uiDebugMode = useMemo(() => isUiDebugModeEnabled(), []);
    const isMewpProject = useMemo(
      () => isMewpProjectName(selectedTeamProject),
      [selectedTeamProject]
    );
    const showMewpViews = isMewpProject;
    const isMewpCoverageMode = showMewpViews && reportMode === 'mewpStandalone';
    const isAtpReleasePlan = useMemo(
      () => isMewpCoverageMode && isAtpReleasePlanName(selectedTestPlan?.text),
      [isMewpCoverageMode, selectedTestPlan?.text]
    );
    const isSingleRelSuiteMode = isAtpReleasePlan;
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
        setMergeDuplicateRequirementCells(false);
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
      const relSuites = suiteOptions.filter((suite) => isRelSuiteOption(suite));
      if (!isSingleRelSuiteMode) return relSuites;
      const relSuiteIds = new Set(relSuites.map((suite) => suite.id));
      return relSuites.filter((suite) => !suite?.parent || !relSuiteIds.has(suite.parent));
    }, [isMewpCoverageMode, suiteOptions, isRelSuiteOption, isSingleRelSuiteMode]);

    const allSuitesSelected = useMemo(() => {
      if (isSingleRelSuiteMode) return false;
      if (!visibleSuiteOptions.length) return false;
      const selectedKeys = new Set((selectedTestSuites || []).map((suite) => suite?.key));
      if (selectedKeys.size < visibleSuiteOptions.length) return false;
      return visibleSuiteOptions.every((suite) => selectedKeys.has(suite.key));
    }, [visibleSuiteOptions, selectedTestSuites, isSingleRelSuiteMode]);

    const suiteSelectionSummary = useMemo(() => {
      if (!selectedTestPlan?.key) return 'Select a test plan to see suites';
      if (store.loadingState?.testSuiteListLoading) return 'Loading suites...';
      if (!visibleSuiteOptions.length) {
        return isMewpCoverageMode
          ? 'No Rel suites available for this plan'
          : 'No suites available for this plan';
      }
      if (isSingleRelSuiteMode) {
        const selectedCount = Array.isArray(selectedTestSuites) ? selectedTestSuites.length : 0;
        return selectedCount
          ? `${selectedCount} of 1 top-level Rel suite selected`
          : 'Select one top-level Rel suite';
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
      isSingleRelSuiteMode,
    ]);

    useEffect(() => {
      if (!Array.isArray(selectedTestSuites)) return;
      const visibleKeys = new Set(visibleSuiteOptions.map((suite) => suite.key));
      let nextSelection = selectedTestSuites.filter((suite) => visibleKeys.has(suite?.key));
      if (isSingleRelSuiteMode && nextSelection.length > 1) {
        nextSelection = [nextSelection[nextSelection.length - 1]];
      }
      const changed =
        nextSelection.length !== selectedTestSuites.length ||
        nextSelection.some((suite, index) => suite?.key !== selectedTestSuites[index]?.key);
      if (changed) {
        setSelectedTestSuites(nextSelection);
      }
    }, [selectedTestSuites, visibleSuiteOptions, isSingleRelSuiteMode]);

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
      const savedMergeDuplicateRequirementCells = dataToSave?.mergeDuplicateRequirementCells;
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
      if (savedMergeDuplicateRequirementCells !== undefined) {
        setMergeDuplicateRequirementCells(!!savedMergeDuplicateRequirementCells);
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
      setMergeDuplicateRequirementCells(false);
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
        } else if (externalValidationState.status !== 'valid') {
          isValid = false;
          message = 'External source files must pass schema validation before generating';
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
          mergeDuplicateRequirementCells: showMewpViews ? mergeDuplicateRequirementCells : false,
          reportMode,
          debugMode: uiDebugMode,
        };

        if (isMewpCoverageMode) {
          addToDocumentRequestObject(
            {
              type: 'mewpStandaloneReporter',
              title: 'mewp-standalone-l2-implementation-content-control',
              skin: 'testReporter',
              data: {
                ...sharedData,
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
      mergeDuplicateRequirementCells,
      reportMode,
      isMewpProject,
      showMewpViews,
      isMewpCoverageMode,
      uiDebugMode,
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
        const projectNameForCache = String(store.teamProjectName || selectedTeamProject?.text || '').trim();
        const bugsSignature = buildExternalValidationSignature(bugsFileRef);
        const l3l4Signature = buildExternalValidationSignature(l3l4FileRef);
        const cachedBugsDetails = bugsFileRef
          ? readExternalValidationCache(projectNameForCache, 'bugs', bugsSignature)
          : undefined;
        const cachedL3L4Details = l3l4FileRef
          ? readExternalValidationCache(projectNameForCache, 'l3l4', l3l4Signature)
          : undefined;
        const needBugsValidation = !!bugsFileRef && !cachedBugsDetails;
        const needL3L4Validation = !!l3l4FileRef && !cachedL3L4Details;

        if (!needBugsValidation && !needL3L4Validation) {
          const fromCache = {
            valid: true,
            bugs: cachedBugsDetails,
            l3l4: cachedL3L4Details,
          };
          setExternalValidationState({ status: 'valid', message: '', details: fromCache });
          return fromCache;
        }
        try {
          setExternalValidationState({ status: 'validating', message: '', details: null });
          const response = await store.validateMewpExternalIngestionFiles({
            externalBugsFile: needBugsValidation ? bugsFileRef || null : null,
            externalL3L4File: needL3L4Validation ? l3l4FileRef || null : null,
          });
          const combined = {
            valid: true,
            bugs: cachedBugsDetails || response?.bugs,
            l3l4: cachedL3L4Details || response?.l3l4,
          };
          combined.valid = [combined.bugs, combined.l3l4]
            .filter(Boolean)
            .every((item) => item?.valid === true);

          if (combined?.bugs?.valid && bugsSignature) {
            writeExternalValidationCache(projectNameForCache, 'bugs', bugsSignature, combined.bugs);
          }
          if (combined?.l3l4?.valid && l3l4Signature) {
            writeExternalValidationCache(projectNameForCache, 'l3l4', l3l4Signature, combined.l3l4);
          }
          if (combined?.valid) {
            setExternalValidationState({ status: 'valid', message: '', details: combined });
            if (!silent) {
              toast.success('External source files are valid');
            }
            return combined;
          }
          const message = buildExternalValidationMessage(combined);
          setExternalValidationState({ status: 'invalid', message, details: combined });
          if (!silent) {
            toast.error(message, { autoClose: false });
          }
          return combined;
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
      [isMewpCoverageMode, store, selectedTeamProject?.text]
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
        showUploadList: false,
        fileList: [],
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
                label={
                  isSingleRelSuiteMode
                    ? 'Top-level Rel suite (descendants auto-included)'
                    : 'Test suites (descendants auto-included)'
                }
                placeholder='Search suites...'
                textFieldProps={{
                  size: 'small',
                  helperText: selectedTestPlan?.key
                    ? isSingleRelSuiteMode
                      ? 'ATP Release mode: pick one top-level Rel suite'
                      : 'Descendants are auto-included'
                    : 'Select a test plan first',
                }}
                showCheckbox={!isSingleRelSuiteMode}
                disabled={!selectedTestPlan?.key}
                onChange={async (_event, newValue) => {
                  if (isSingleRelSuiteMode) {
                    const nextSelection = Array.isArray(newValue)
                      ? newValue.length
                        ? [newValue[newValue.length - 1]]
                        : []
                      : [];
                    setSelectedTestSuites(nextSelection);
                    return;
                  }
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
                        isSingleRelSuiteMode ||
                        !selectedTestPlan?.key ||
                        store.loadingState?.testSuiteListLoading ||
                        visibleSuiteOptions.length === 0
                      }
                    />
                  }
                  label={
                    <Typography variant='body2'>
                      {isSingleRelSuiteMode ? 'Single suite mode' : 'Select all suites'}
                    </Typography>
                  }
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

    const renderExternalSourcePanel = ({
      docType,
      title,
      label,
      uploadButtonLabel,
      fileItem,
      setFileItem,
    }) => {
      const tableDetails = resolveExternalTableValidationDetails(externalValidationState, docType);
      const missingColumns = Array.isArray(tableDetails?.missingRequiredColumns)
        ? tableDetails.missingRequiredColumns
        : [];
      const hasFile = !!fileItem;
      const isValid = tableDetails?.valid === true;
      const isInvalid = tableDetails?.valid === false;
      const isValidating = externalValidationState.status === 'validating' && hasFile;
      const statusLabel = !hasFile
        ? 'No file provided'
        : isValidating
        ? 'Validation in progress...'
        : isValid
        ? 'Valid format'
        : isInvalid
        ? 'Invalid format'
        : 'Awaiting validation';
      const statusColor = !hasFile
        ? 'text.secondary'
        : isValidating
        ? 'warning.main'
        : isValid
        ? 'success.main'
        : isInvalid
        ? 'error.main'
        : 'text.secondary';

      return (
        <Stack
          spacing={1.1}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            p: 1.25,
            backgroundColor: 'background.paper',
            height: '100%',
            minHeight: 220,
          }}
        >
          <Typography variant='subtitle2'>{title}</Typography>
          <Typography variant='caption' color={statusColor}>
            {statusLabel}
          </Typography>
          {hasFile && tableDetails ? (
            <Typography variant='caption' color='text.secondary'>
              Header row: {tableDetails.headerRow || 'n/a'} | Matched columns:{' '}
              {Number(tableDetails.matchedRequiredColumns || 0)}/
              {Number(tableDetails.totalRequiredColumns || 0)} | Data rows:{' '}
              {Number(tableDetails.rowCount || 0)}
            </Typography>
          ) : null}
          {missingColumns.length > 0 ? (
            <Typography variant='caption' color='error.main'>
              Missing columns: {missingColumns.join(', ')}
            </Typography>
          ) : null}
          {tableDetails?.message ? (
            <Typography variant='caption' color={isInvalid ? 'error.main' : 'text.secondary'}>
              {tableDetails.message}
            </Typography>
          ) : null}
          <Stack spacing={1}>
            <Typography variant='body2'>{label}</Typography>
            <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Upload
                key={`${docType}-${externalUploadResetVersion[docType] || 0}`}
                {...createExternalUploadProps(docType, (uploadedFileItem) => setFileItem(uploadedFileItem))}
              >
                <Button icon={<UploadOutlined />} loading={externalSourcesBusy}>
                  {uploadButtonLabel}
                </Button>
              </Upload>
              <Button
                size='small'
                icon={<ReloadOutlined />}
                onClick={() => restoreLatestExternalByType(docType)}
                loading={externalSourcesBusy}
              >
                Recover Mine
              </Button>
              <Button
                size='small'
                danger
                icon={<DeleteOutlined />}
                disabled={!fileItem}
                loading={externalSourcesBusy}
                onClick={() =>
                  deleteExternalMewpSource(docType, fileItem, () => {
                    setFileItem(null);
                    setExternalUploadResetVersion((prev) => ({
                      ...prev,
                      [docType]: Number(prev?.[docType] || 0) + 1,
                    }));
                  })
                }
              >
                Delete
              </Button>
            </Stack>
            <Typography variant='caption' color='text.secondary'>
              {getFileDisplayName(fileItem) || 'No file uploaded'}
            </Typography>
          </Stack>
        </Stack>
      );
    };

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
                  checked={mergeDuplicateRequirementCells}
                  onChange={(_event, checked) => setMergeDuplicateRequirementCells(checked)}
                />
              }
              label='Merge duplicate requirement cells (L2/L3 layout hint)'
            />
            {externalValidationState.status === 'validating' ? (
              <Typography variant='caption' color='warning.main'>
                Validating external source files...
              </Typography>
            ) : null}
            {externalValidationState.status === 'invalid' ? (
              <Typography variant='caption' color='error.main'>
                {externalValidationState.message}
              </Typography>
            ) : null}
            {externalValidationState.status === 'valid' ? (
              <Typography variant='caption' color='success.main'>
                External source files passed schema validation.
              </Typography>
            ) : null}
            <Grid container spacing={1.25} alignItems='stretch'>
              <Grid size={{ xs: 12, md: 6 }}>
                {renderExternalSourcePanel({
                  docType: 'bugs',
                  title: 'Bugs table validation',
                  label: 'External Bugs table (CSV/XLSX)',
                  uploadButtonLabel: 'Upload Bugs File',
                  fileItem: externalBugsFile,
                  setFileItem: setExternalBugsFile,
                })}
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                {renderExternalSourcePanel({
                  docType: 'l3l4',
                  title: 'L3/L4 table validation',
                  label: 'External L3/L4 table (CSV/XLSX)',
                  uploadButtonLabel: 'Upload L3/L4 File',
                  fileItem: externalL3L4File,
                  setFileItem: setExternalL3L4File,
                })}
              </Grid>
            </Grid>
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
