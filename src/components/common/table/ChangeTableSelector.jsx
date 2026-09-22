import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import GitObjectRangeSelector from '../selectors/GitObjectRangeSelector';
import CommitDateSelector from '../selectors/CommitDateSelector';
import PipelineSelector from '../selectors/PipelineSelector';
import ReleaseSelector from '../selectors/ReleaseSelector';
import { observer } from 'mobx-react';
import {
  Box,
  Grid,
  Stack,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ListAltIcon from '@mui/icons-material/ListAlt';
import TerminalIcon from '@mui/icons-material/Terminal';
import SmartAutocomplete from '../SmartAutocomplete';
import PullRequestSelector from '../selectors/PullRequestSelector';
import { toast } from 'react-toastify';
import UploadAttachmentFileButton from '../UploadAttachmentFileButton';
import LinkedWiSelectionDialog from '../../dialogs/LinkedWiSelectionDialog';
import SettingsDisplay from '../SettingsDisplay';
import SectionCard from '../../layout/SectionCard';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import RestoreBackdrop from '../RestoreBackdrop';
import ToggleCard from '../ToggleCard';
import WorkItemFilterSection from '../svdSections/WorkItemFilterSection';
import QueriesSection from '../svdSections/QueriesSection';
import AutoSvdPanel from './AutoSvdPanel';

const baseChangeTableDataType = [
  { key: 0, text: 'GIT Object Range', type: 'range' },
  { key: 1, text: 'Commit Date', type: 'date' },
  { key: 2, text: 'Pipeline Range', type: 'pipeline' },
  { key: 3, text: 'Release Range', type: 'release' },
  // { key: 4, text: "pullrequest-range", type: "pullrequest" },
];

const defaultSelectedQueriesForChangeTableSelector = {
  sysOverviewQuery: null,
  knownBugsQuery: null,
};

const defaultLinkedWiOptions = { isEnabled: false, linkedWiTypes: 'both', linkedWiRelationship: 'both' };

/**
 * ChangeTableSelector (SVD)
 * Manages base data type, query selections, and filters with session/favorite restore.
 */
const ChangeTableSelector = observer(
  forwardRef(function ChangeTableSelector(
    {
      store,
      selectedTeamProject,
      contentControlTitle,
      editingMode,
      addToDocumentRequestObject,
      contentControlIndex,
      sharedQueries,
      onModeChange,
      onValidityChange,
    },
    ref
  ) {
    const [selectedType, setSelectedType] = useState(null);
    const [queryTrees, setQueryTrees] = useState({
      systemOverviewQueryTree: [],
      knownBugsQueryTree: [],
    });
    const [queriesRequest, setQueriesRequest] = useState(defaultSelectedQueriesForChangeTableSelector);
    const [loadedData, setLoadedData] = useState(undefined);
    const [includeSystemOverview, setIncludeSystemOverview] = useState(false);
    const [includeKnownBugs, setIncludeKnownBugs] = useState(false);
    const [includeCommittedBy, setIncludeCommittedBy] = useState(false);
    const [includeUnlinkedCommits, setIncludeUnlinkedCommits] = useState(false);
    const [includePullRequestWorkItems, setIncludePullRequestWorkItems] = useState(false);
    const [replaceTaskWithParent, setReplaceTaskWithParent] = useState(false);
    const [includeWorkItemFilter, setIncludeWorkItemFilter] = useState(false);
    const [selectedWorkItemTypes, setSelectedWorkItemTypes] = useState([]);
    const [selectedWorkItemStates, setSelectedWorkItemStates] = useState([]);
    const [linkedWiOptions, setLinkedWiOptions] = useState(defaultLinkedWiOptions);
    // Local restoring coordinates subselector hydration; hook provides base restoring for parent flow
    const [isRestoring, setIsRestoring] = useState(false);
    // 'manual' (today's Generate-a-document flow, untouched) | 'auto' (produces a
    // pipeline setup snippet — see AutoSvdPanel.jsx). Work item filters, queries,
    // wiki file, and linked work items are shared between both modes (rendered
    // once, below); only the Base Data / Range side of the page changes.
    const [mode, setMode] = useState('manual');
    const autoSvdPanelRef = useRef(null);

    useEffect(() => {
      onModeChange && onModeChange(mode);
    }, [mode, onModeChange]);

    useImperativeHandle(ref, () => ({
      generateAutoSnippet: () => autoSvdPanelRef.current?.generateSnippet(),
    }));

    const workItemTypeOptions = useMemo(
      () =>
        (store.workItemTypes || []).map((type) => ({
          key: type.name,
          text: type.name,
          ...type,
        })),
      [store.workItemTypes]
    );

    const workItemStateOptions = useMemo(() => {
      const stateMap = new Map();
      selectedWorkItemTypes.forEach((type) => {
        (type?.states || []).forEach((state) => {
          const key = state?.name;
          if (!key || stateMap.has(key)) return;
          stateMap.set(key, {
            key,
            text: state.name,
            ...state,
          });
        });
      });
      return Array.from(stateMap.values());
    }, [selectedWorkItemTypes]);

    useEffect(() => {
      setSelectedWorkItemStates((prev) => {
        const filtered = prev.filter((state) => {
          const stateKey = state?.key || state?.name || state?.text;
          return workItemStateOptions.some((option) => option.key === stateKey);
        });
        if (filtered.length === prev.length && filtered.every((item, index) => item === prev[index])) {
          return prev;
        }
        return filtered;
      });
    }, [workItemStateOptions]);

    const workItemFilterOptionsPayload = useMemo(() => {
      if (!includeWorkItemFilter) {
        return { isEnabled: false, workItemTypes: [], workItemStates: [] };
      }
      const normalizedTypes = Array.from(
        new Set(
          selectedWorkItemTypes
            .map((type) => String(type?.key || type?.name || type?.text || '').toLowerCase())
            .filter(Boolean)
        )
      );
      const normalizedStates = Array.from(
        new Set(
          selectedWorkItemStates
            .map((state) => String(state?.name || state?.text || state?.key || '').toLowerCase())
            .filter(Boolean)
        )
      );
      const workItemTypeDetails = selectedWorkItemTypes
        .map((type) => ({
          key: type?.key || type?.name || type?.text,
          text: type?.text || type?.name || '',
          icon: type?.icon,
          color: type?.color,
        }))
        .filter((type) => String(type?.text || '').trim());
      const workItemStateDetails = selectedWorkItemStates
        .map((state) => ({
          key: state?.key || state?.name || state?.text,
          text: state?.text || state?.name || '',
          color: state?.color,
          category: state?.category,
        }))
        .filter((state) => String(state?.text || '').trim());
      return {
        isEnabled: includeWorkItemFilter,
        workItemTypes: normalizedTypes,
        workItemStates: normalizedStates,
        workItemTypeDetails,
        workItemStateDetails,
      };
    }, [includeWorkItemFilter, selectedWorkItemStates, selectedWorkItemTypes]);
    const handleClearAttachment = useCallback(() => {
      store.setAttachmentWiki(undefined);
    }, [store]);

    useEffect(() => {
      handleClearAttachment();
    }, [handleClearAttachment]); // Empty dependency array ensures this runs only on mount
    const onSelectedSystemOverviewQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({ ...prev, sysOverviewQuery: query }));
    }, []);

    const onSelectedKnownBugsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({ ...prev, knownBugsQuery: query }));
    }, []);
    // Helper functions outside the effect (but inside the component)
    const processSystemOverviewData = useCallback(
      (systemOverviewQuery) => {
        if (!systemOverviewQuery) {
          setIncludeSystemOverview(false);
          setIncludeKnownBugs(false);
          setQueriesRequest(defaultSelectedQueriesForChangeTableSelector);
          return;
        }

        const sysOverviewQuery = systemOverviewQuery.sysOverviewQuery ?? null;
        const knownBugsQuery = systemOverviewQuery.knownBugsQuery ?? null;

        setIncludeSystemOverview(Boolean(sysOverviewQuery));
        setIncludeKnownBugs(Boolean(knownBugsQuery));
        onSelectedSystemOverviewQuery(sysOverviewQuery);
        onSelectedKnownBugsQuery(knownBugsQuery);
      },
      [onSelectedSystemOverviewQuery, onSelectedKnownBugsQuery]
    );

    const processLinkedWiOptions = useCallback((linkedWiOptions) => {
      if (!linkedWiOptions) {
        setLinkedWiOptions(defaultLinkedWiOptions);
        return;
      }
      setLinkedWiOptions(linkedWiOptions);
    }, []);

    const processWorkItemFilterOptions = useCallback(
      (workItemFilterOptions) => {
        if (!workItemFilterOptions?.isEnabled) {
          setIncludeWorkItemFilter(false);
          setSelectedWorkItemTypes([]);
          setSelectedWorkItemStates([]);
          return;
        }

        setIncludeWorkItemFilter(true);

        const typeSources = Array.isArray(workItemFilterOptions.workItemTypes)
          ? workItemFilterOptions.workItemTypes
          : workItemFilterOptions.workItemType
          ? [workItemFilterOptions.workItemType]
          : [];

        const resolvedTypes = typeSources
          .map((typeSource) => {
            if (!typeSource) return null;
            if (typeof typeSource === 'string') {
              const match = workItemTypeOptions.find(
                (option) => option.key?.toLowerCase() === typeSource.toLowerCase()
              );
              return match || null;
            }
            const matchedType = workItemTypeOptions.find(
              (option) => option.key === typeSource.key || option.name === typeSource.name
            );
            if (matchedType) return matchedType;
            return {
              key: typeSource.name || typeSource.key,
              text: typeSource.name || typeSource.key,
              ...typeSource,
              states: typeSource.states || [],
            };
          })
          .filter(Boolean);
        setSelectedWorkItemTypes(resolvedTypes);

        const availableStates = resolvedTypes.flatMap((type) => type?.states || []);
        const stateSources = Array.isArray(workItemFilterOptions.workItemStates)
          ? workItemFilterOptions.workItemStates
          : workItemFilterOptions.workItemState
          ? [workItemFilterOptions.workItemState]
          : [];

        const resolvedStates = stateSources
          .map((stateSource) => {
            if (!stateSource) return null;
            const targetStateName =
              typeof stateSource === 'string'
                ? stateSource
                : stateSource.name || stateSource.text || stateSource.key;
            if (!targetStateName) return null;
            const targetStateLower = targetStateName.toLowerCase();
            const matchedState = availableStates.find(
              (state) => String(state?.name || '').toLowerCase() === targetStateLower
            );
            if (matchedState) {
              return {
                key: matchedState.name,
                text: matchedState.name,
                ...matchedState,
              };
            }
            return {
              key: targetStateName,
              text: targetStateName,
              name: targetStateName,
            };
          })
          .filter(Boolean);
        setSelectedWorkItemStates(resolvedStates);
      },
      [workItemTypeOptions]
    );

    const processRangeTypeSelection = useCallback(({ rangeType }) => {
      if (!rangeType) {
        setSelectedType(null);
        return;
      }
      const selectedTypeObject = baseChangeTableDataType.find((item) => item.type === rangeType);

      if (!selectedTypeObject) {
        throw new Error('Range type not supported');
      }

      setSelectedType(selectedTypeObject);
    }, []);

    useEffect(() => {
      const acquiredTrees = sharedQueries?.acquiredTrees ?? null;
      if (acquiredTrees !== null) {
        setQueryTrees(() => ({
          systemOverviewQueryTree: acquiredTrees.systemOverviewQueryTree
            ? [acquiredTrees.systemOverviewQueryTree]
            : [],
          knownBugsQueryTree: acquiredTrees.knownBugsQueryTree ? [acquiredTrees.knownBugsQueryTree] : [],
        }));
      } else {
        setQueryTrees({
          systemOverviewQueryTree: [],
          knownBugsQueryTree: [],
        });
      }
    }, [sharedQueries?.acquiredTrees]);

    // Report base data type validation to store
    // useLayoutEffect ensures we mark invalid before first paint to keep Send Request disabled by default
    useLayoutEffect(() => {
      const isValid = !!selectedType?.type;
      const message = isValid ? '' : 'Select a base data type';
      try {
        store.setValidationState(contentControlIndex, 'baseType', { isValid, message });
        // Clear any pre-seeded init invalid flag for this control
        store.clearValidationForIndex(contentControlIndex, 'init');
      } catch {
        /* empty */
      }
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'baseType');
        } catch {
          /* empty */
        }
      };
    }, [selectedType, store, contentControlIndex]);

    // Hook-driven restore/clear
    const applySavedData = useCallback(
      async (dataToSave) => {
        setIsRestoring(true);
        try {
          processSystemOverviewData(dataToSave.systemOverviewQuery);
          processLinkedWiOptions(dataToSave.linkedWiOptions);
          processWorkItemFilterOptions(dataToSave.workItemFilterOptions);
          setIncludeCommittedBy(dataToSave.includeCommittedBy || false);
          setIncludeUnlinkedCommits(dataToSave.includeUnlinkedCommits || false);
          setIncludePullRequestWorkItems(dataToSave.includePullRequestWorkItems || false);
          setReplaceTaskWithParent(dataToSave.replaceTaskWithParent || false);
          processRangeTypeSelection(dataToSave);
          setLoadedData(dataToSave);
        } catch (error) {
          toast.error(`Error restoring previous selection: ${error?.message ?? 'Unknown error'}`);
          setIsRestoring(false);
        }
      },
      [
        processSystemOverviewData,
        processLinkedWiOptions,
        processWorkItemFilterOptions,
        processRangeTypeSelection,
        contentControlIndex,
      ]
    );

    const resetLocalState = useCallback(() => {
      setSelectedType(null);
      setQueryTrees({ systemOverviewQueryTree: [], knownBugsQueryTree: [] });
      setQueriesRequest(defaultSelectedQueriesForChangeTableSelector);
      setLoadedData(undefined);
      setIncludeSystemOverview(false);
      setIncludeKnownBugs(false);
      setIncludeCommittedBy(false);
      setIncludeUnlinkedCommits(false);
      setIncludePullRequestWorkItems(false);
      setReplaceTaskWithParent(false);
      setIncludeWorkItemFilter(false);
      setSelectedWorkItemTypes([]);
      setSelectedWorkItemStates([]);
      setLinkedWiOptions(defaultLinkedWiOptions);
      setIsRestoring(false);
    }, []);

    const { isRestoring: baseRestoring } = useTabStatePersistence({
      store,
      contentControlIndex,
      applySavedData,
      resetLocalState,
    });

    useEffect(() => {
      if (!baseRestoring && isRestoring) {
        setIsRestoring(false);
      }
    }, [isRestoring, baseRestoring, contentControlIndex]);

    const handleNewFileUploaded = (fileObject) => {
      if (fileObject) {
        store.setAttachmentWiki(fileObject?.url);
      }
    };

    const generateIncludedLinkedWorkItemSelection = () => {
      const settings = [];
      if (linkedWiOptions?.isEnabled) {
        if (linkedWiOptions.linkedWiTypes !== 'both') {
          settings.push(
            `Per change: include ${
              linkedWiOptions.linkedWiTypes !== 'reqOnly' ? 'Feature Only' : 'Requirement Only'
            }`
          );
        } else {
          settings.push('Per change: include both Feature and Requirement');
        }

        if (linkedWiOptions?.linkedWiRelationship !== 'both') {
          settings.push(
            `Per change: include ${
              linkedWiOptions.linkedWiRelationship !== 'affectsOnly' ? 'Affects Only' : 'Covers Only'
            } related items`
          );
        } else {
          settings.push('Per change: include both Affects and Covers related items');
        }
      }

      return settings;
    };

    const linkedWiSummary = generateIncludedLinkedWorkItemSelection();

    const baseSummary = selectedType?.text
      ? `Base type: ${selectedType.text}`
      : 'Pick a base data type to configure the range.';

    return (
      <>
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            color='primary'
            size='small'
            exclusive
            value={mode}
            onChange={(_event, next) => {
              if (!next) return;
              setMode(next);
            }}
            aria-label='SVD mode'
            sx={{ alignSelf: 'flex-start' }}
          >
            <ToggleButton value='manual'>
              <ListAltIcon
                fontSize='small'
                sx={{ mr: 0.75 }}
              />
              Manual SVD
            </ToggleButton>
            <ToggleButton value='auto'>
              <TerminalIcon
                fontSize='small'
                sx={{ mr: 0.75 }}
              />
              Auto SVD
            </ToggleButton>
          </ToggleButtonGroup>

          <Grid
            container
            spacing={1.5}
            alignItems='stretch'
          >
            <Grid
              size={{ xs: 12, lg: 8 }}
              sx={{ minWidth: 0 }}
            >
              {mode === 'auto' ? (
                <AutoSvdPanel
                  ref={autoSvdPanelRef}
                  store={store}
                  selectedTeamProject={selectedTeamProject}
                  workItemFilterOptions={workItemFilterOptionsPayload}
                  queriesRequest={queriesRequest}
                  attachmentWikiUrl={store.attachmentWikiUrl}
                  linkedWiOptions={linkedWiOptions}
                  includeCommittedBy={includeCommittedBy}
                  onIncludeCommittedByChange={setIncludeCommittedBy}
                  includeUnlinkedCommits={includeUnlinkedCommits}
                  onIncludeUnlinkedCommitsChange={setIncludeUnlinkedCommits}
                  includePullRequestWorkItems={includePullRequestWorkItems}
                  onIncludePullRequestWorkItemsChange={setIncludePullRequestWorkItems}
                  replaceTaskWithParent={replaceTaskWithParent}
                  onReplaceTaskWithParentChange={setReplaceTaskWithParent}
                  onValidityChange={onValidityChange}
                />
              ) : (
              <SectionCard
                title='Base Data'
                description='Pick the primary source that drives this change log.'
              >
                <Stack spacing={1.25}>
                  <SmartAutocomplete
                    disableClearable
                    autoHighlight
                    openOnFocus
                    options={baseChangeTableDataType}
                    value={selectedType}
                    label='Base data type'
                    onChange={(_event, newValue) => setSelectedType(newValue)}
                  />

                  {selectedType?.type === 'range' ? (
                    <GitObjectRangeSelector
                      store={store}
                      contentControlTitle={contentControlTitle}
                      skin='change-table'
                      editingMode={editingMode}
                      addToDocumentRequestObject={addToDocumentRequestObject}
                      contentControlIndex={contentControlIndex}
                      queriesRequest={queriesRequest}
                      dataToRead={loadedData}
                      linkedWiOptions={linkedWiOptions}
                      includeCommittedBy={includeCommittedBy}
                      includeUnlinkedCommits={includeUnlinkedCommits}
                      includePullRequestWorkItems={includePullRequestWorkItems}
                      replaceTaskWithParent={replaceTaskWithParent}
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => {
                        setIsRestoring(false);
                      }}
                    />
                  ) : null}
                  {selectedType?.type === 'date' ? (
                    <CommitDateSelector
                      store={store}
                      contentControlTitle={contentControlTitle}
                      skin='change-table'
                      repoList={store.repoList}
                      editingMode={editingMode}
                      addToDocumentRequestObject={addToDocumentRequestObject}
                      contentControlIndex={contentControlIndex}
                      queriesRequest={queriesRequest}
                      dataToRead={loadedData}
                      linkedWiOptions={linkedWiOptions}
                      includeCommittedBy={includeCommittedBy}
                      includeUnlinkedCommits={includeUnlinkedCommits}
                      includePullRequestWorkItems={includePullRequestWorkItems}
                      replaceTaskWithParent={replaceTaskWithParent}
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => {
                        setIsRestoring(false);
                      }}
                    />
                  ) : null}
                  {selectedType?.type === 'pipeline' ? (
                    <PipelineSelector
                      store={store}
                      contentControlTitle={contentControlTitle}
                      skin='change-table'
                      editingMode={editingMode}
                      addToDocumentRequestObject={addToDocumentRequestObject}
                      contentControlIndex={contentControlIndex}
                      queriesRequest={queriesRequest}
                      dataToRead={loadedData}
                      linkedWiOptions={linkedWiOptions}
                      includeCommittedBy={includeCommittedBy}
                      includeUnlinkedCommits={includeUnlinkedCommits}
                      includePullRequestWorkItems={includePullRequestWorkItems}
                      replaceTaskWithParent={replaceTaskWithParent}
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => {
                        setIsRestoring(false);
                      }}
                    />
                  ) : null}
                  {selectedType?.type === 'release' ? (
                    <ReleaseSelector
                      store={store}
                      contentControlTitle={contentControlTitle}
                      skin='change-table'
                      editingMode={editingMode}
                      addToDocumentRequestObject={addToDocumentRequestObject}
                      contentControlIndex={contentControlIndex}
                      queriesRequest={queriesRequest}
                      dataToRead={loadedData}
                      linkedWiOptions={linkedWiOptions}
                      includeCommittedBy={includeCommittedBy}
                      includeUnlinkedCommits={includeUnlinkedCommits}
                      includePullRequestWorkItems={includePullRequestWorkItems}
                      replaceTaskWithParent={replaceTaskWithParent}
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => setIsRestoring(false)}
                    />
                  ) : null}
                  {selectedType?.type === 'pullrequest' ? (
                    <PullRequestSelector
                      store={store}
                      contentControlTitle={contentControlTitle}
                      skin='change-table'
                      repoList={store.repoList}
                      pullRequests={store.pullRequestList}
                      editingMode={editingMode}
                      addToDocumentRequestObject={addToDocumentRequestObject}
                      contentControlIndex={contentControlIndex}
                      queriesRequest={queriesRequest}
                      dataToRead={loadedData}
                      linkedWiOptions={linkedWiOptions}
                      includeCommittedBy={includeCommittedBy}
                      includeUnlinkedCommits={includeUnlinkedCommits}
                      includePullRequestWorkItems={includePullRequestWorkItems}
                      replaceTaskWithParent={replaceTaskWithParent}
                      workItemFilterOptions={workItemFilterOptionsPayload}
                    />
                  ) : null}

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                    >
                      {baseSummary}
                    </Typography>
                  </Box>
                  <Grid
                    container
                    spacing={1.5}
                    alignItems='stretch'
                  >
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <ToggleCard
                        icon={LinkOffIcon}
                        title='Unlinked commits'
                        description='Include commits without linked work items.'
                        checked={includeUnlinkedCommits}
                        onChange={setIncludeUnlinkedCommits}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <ToggleCard
                        icon={CallMergeIcon}
                        title='PR work items'
                        description='Merge work items linked only to the PR.'
                        checked={includePullRequestWorkItems}
                        onChange={setIncludePullRequestWorkItems}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <ToggleCard
                        icon={PersonOutlineIcon}
                        title='Committer'
                        description='Show the committer column in the table.'
                        checked={includeCommittedBy}
                        onChange={setIncludeCommittedBy}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <ToggleCard
                        icon={AccountTreeIcon}
                        title='Replace Task'
                        description='Replace Task work items with their parent.'
                        checked={replaceTaskWithParent}
                        onChange={setReplaceTaskWithParent}
                        info={
                          <Tooltip
                            arrow
                            placement='top'
                            componentsProps={{
                              tooltip: {
                                sx: { maxWidth: 420, p: 1, '& .MuiTypography-root': { lineHeight: 1.35 } },
                              },
                            }}
                            title={
                              <Box>
                                <Typography variant='body2'>
                                  When enabled, Task work items are replaced by their immediate parent
                                  Requirement (1 level).
                                </Typography>
                                <Stack
                                  direction='row'
                                  alignItems='center'
                                  spacing={0.5}
                                  sx={{ mt: 0.5 }}
                                >
                                  <WarningAmberOutlinedIcon
                                    sx={{ color: 'warning.main' }}
                                    fontSize='small'
                                  />
                                  <Typography
                                    variant='caption'
                                    sx={{ color: 'warning.main', fontWeight: 600 }}
                                  >
                                    With this mode on, Task items will not be displayed.
                                  </Typography>
                                </Stack>
                              </Box>
                            }
                          >
                            <InfoOutlinedIcon
                              fontSize='small'
                              color='info'
                            />
                          </Tooltip>
                        }
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </SectionCard>
              )}
            </Grid>

            <Grid
              size={{ xs: 12, lg: 4 }}
              sx={{ minWidth: 0 }}
            >
              <Stack
                spacing={1.5}
                sx={{ minHeight: '100%' }}
              >
                <WorkItemFilterSection
                  includeWorkItemFilter={includeWorkItemFilter}
                  onIncludeChange={setIncludeWorkItemFilter}
                  selectedWorkItemTypes={selectedWorkItemTypes}
                  onTypesChange={setSelectedWorkItemTypes}
                  selectedWorkItemStates={selectedWorkItemStates}
                  onStatesChange={setSelectedWorkItemStates}
                  workItemTypeOptions={workItemTypeOptions}
                  workItemStateOptions={workItemStateOptions}
                  loading={store.loadingState.workItemTypesLoadingState}
                />
                <QueriesSection
                  queryTrees={queryTrees}
                  queriesRequest={queriesRequest}
                  includeSystemOverview={includeSystemOverview}
                  onIncludeSystemOverviewChange={(checked) => {
                    setIncludeSystemOverview(checked);
                    if (!checked) setQueriesRequest((prev) => ({ ...prev, sysOverviewQuery: null }));
                  }}
                  includeKnownBugs={includeKnownBugs}
                  onIncludeKnownBugsChange={(checked) => {
                    setIncludeKnownBugs(checked);
                    if (!checked) setQueriesRequest((prev) => ({ ...prev, knownBugsQuery: null }));
                  }}
                  onSelectedSystemOverviewQuery={onSelectedSystemOverviewQuery}
                  onSelectedKnownBugsQuery={onSelectedKnownBugsQuery}
                  loading={store.fetchLoadingState().sharedQueriesLoadingState}
                />

                <SectionCard
                  title='Wiki File'
                  compact
                >
                  <UploadAttachmentFileButton
                    store={store}
                    onNewFileUpload={handleNewFileUploaded}
                    onClear={handleClearAttachment}
                    bucketName='wiki-attachments'
                    isDisabled={!selectedTeamProject}
                  />
                </SectionCard>

                <SectionCard
                  title='Linked work items'
                  description='Fetch linked Requirements/Features for each included change.'
                  compact
                  actions={
                    <LinkedWiSelectionDialog
                      prevOptions={linkedWiOptions}
                      setOptions={setLinkedWiOptions}
                      buttonLabel='Configure'
                      buttonVariant='text'
                      buttonSize='small'
                      tooltipTitle='Configure per-change linked work items'
                    />
                  }
                >
                  <Stack spacing={1.25}>
                    <SettingsDisplay
                      title='Configured values'
                      settings={linkedWiSummary}
                      emptyMessage='Per-change linked work items disabled.'
                      boxProps={{ p: 0, bgcolor: 'transparent' }}
                    />
                  </Stack>
                </SectionCard>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
        <RestoreBackdrop
          open={!!(isRestoring || baseRestoring)}
          label='Restoring SVD selection…'
        />
      </>
    );
  })
);

export default ChangeTableSelector;
