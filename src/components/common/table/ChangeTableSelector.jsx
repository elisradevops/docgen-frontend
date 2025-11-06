import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import GitObjectRangeSelector from '../selectors/GitObjectRangeSelector';
import CommitDateSelector from '../selectors/CommitDateSelector';
import PipelineSelector from '../selectors/PipelineSelector';
import ReleaseSelector from '../selectors/ReleaseSelector';
import { observer } from 'mobx-react';
import { Box, Checkbox, Collapse, FormControlLabel, Typography, Grid, Stack, Button } from '@mui/material';
import SmartAutocomplete from '../SmartAutocomplete';
import PullRequestSelector from '../selectors/PullRequestSelector';
import QueryTree from '../QueryTree';
import { toast } from 'react-toastify';
import UploadAttachmentFileButton from '../UploadAttachmentFileButton';
import LinkedWiSelectionDialog from '../../dialogs/LinkedWiSelectionDialog';
import SettingsDisplay from '../SettingsDisplay';
import SectionCard from '../../layout/SectionCard';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import RestoreBackdrop from '../RestoreBackdrop';

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
  ({
    store,
    selectedTeamProject,
    contentControlTitle,
    editingMode,
    addToDocumentRequestObject,
    contentControlIndex,
    sharedQueries,
  }) => {
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
    const [includeWorkItemFilter, setIncludeWorkItemFilter] = useState(false);
    const [selectedWorkItemTypes, setSelectedWorkItemTypes] = useState([]);
    const [selectedWorkItemStates, setSelectedWorkItemStates] = useState([]);
    const [linkedWiOptions, setLinkedWiOptions] = useState(defaultLinkedWiOptions);
    // Local restoring coordinates subselector hydration; hook provides base restoring for parent flow
    const [isRestoring, setIsRestoring] = useState(false);

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
      return {
        isEnabled: includeWorkItemFilter,
        workItemTypes: normalizedTypes,
        workItemStates: normalizedStates,
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
        // Start local restoring to block subselector saves until it calls onRestored
        setIsRestoring(true);
        try {
          processSystemOverviewData(dataToSave.systemOverviewQuery);
          processLinkedWiOptions(dataToSave.linkedWiOptions);
          processWorkItemFilterOptions(dataToSave.workItemFilterOptions);
          setIncludeCommittedBy(dataToSave.includeCommittedBy || false);
          setIncludeUnlinkedCommits(dataToSave.includeUnlinkedCommits || false);
          processRangeTypeSelection(dataToSave);
          setLoadedData(dataToSave);
        } catch (error) {
          toast.error(`Error restoring previous selection: ${error?.message ?? 'Unknown error'}`);
        }
      },
      [
        processSystemOverviewData,
        processLinkedWiOptions,
        processWorkItemFilterOptions,
        processRangeTypeSelection,
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

    const workItemFilterSummary = includeWorkItemFilter
      ? [
          selectedWorkItemTypes.length
            ? selectedWorkItemTypes.length === workItemTypeOptions.length
              ? 'Types: All'
              : `Types (${selectedWorkItemTypes.length}): ${selectedWorkItemTypes
                  .map((type) => type.text || type.name)
                  .join(', ')}`
            : 'Types: All',
          selectedWorkItemStates.length
            ? selectedWorkItemStates.length === workItemStateOptions.length
              ? 'States: All'
              : `States (${selectedWorkItemStates.length}): ${selectedWorkItemStates
                  .map((state) => state.text || state.name)
                  .join(', ')}`
            : 'States: All',
        ]
      : [];

    const baseSummary = selectedType?.text
      ? `Base type: ${selectedType.text}`
      : 'Pick a base data type to configure the range.';

    return (
      <>
        <Stack spacing={1.5}>
          <Grid
            container
            spacing={1.5}
            alignItems='stretch'
          >
            <Grid
              size={{ xs: 12, lg: 8 }}
              sx={{ minWidth: 0 }}
            >
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
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => setIsRestoring(false)}
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
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => setIsRestoring(false)}
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
                      workItemFilterOptions={workItemFilterOptionsPayload}
                      isRestoring={isRestoring || baseRestoring}
                      onRestored={() => setIsRestoring(false)}
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
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.25}
                    alignItems='flex-start'
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeUnlinkedCommits}
                          onChange={(_event, checked) => setIncludeUnlinkedCommits(checked)}
                        />
                      }
                      label='Include commits without linked work items'
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeCommittedBy}
                          onChange={(_event, checked) => setIncludeCommittedBy(checked)}
                        />
                      }
                      label='Include committer'
                    />
                  </Stack>
                </Stack>
              </SectionCard>
            </Grid>

            <Grid
              size={{ xs: 12, lg: 4 }}
              sx={{ minWidth: 0 }}
            >
              <Stack
                spacing={1.5}
                sx={{ minHeight: '100%' }}
              >
                <SectionCard
                  title='Work item filters'
                  compact
                >
                  <Stack spacing={1.25}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeWorkItemFilter}
                          onChange={(_event, checked) => {
                            setIncludeWorkItemFilter(checked);
                            if (!checked) {
                              setSelectedWorkItemTypes([]);
                              setSelectedWorkItemStates([]);
                            }
                          }}
                        />
                      }
                      label='Filter changes by work item type and state'
                    />
                    <Collapse
                      in={includeWorkItemFilter}
                      timeout='auto'
                      unmountOnExit
                    >
                      <Stack spacing={1.25}>
                        <Stack
                          direction='row'
                          spacing={1}
                          flexWrap='wrap'
                        >
                          <Button
                            size='small'
                            onClick={() => {
                              setSelectedWorkItemTypes([...workItemTypeOptions]);
                            }}
                            disabled={workItemTypeOptions.length === 0}
                          >
                            Select all types
                          </Button>
                          <Button
                            size='small'
                            onClick={() => {
                              setSelectedWorkItemTypes([]);
                              setSelectedWorkItemStates([]);
                            }}
                            disabled={
                              selectedWorkItemTypes.length === 0 && selectedWorkItemStates.length === 0
                            }
                          >
                            Clear selection
                          </Button>
                        </Stack>
                        <SmartAutocomplete
                          multiple
                          showCheckbox
                          autoHighlight
                          openOnFocus
                          options={workItemTypeOptions}
                          value={selectedWorkItemTypes}
                          loading={store.loadingState.workItemTypesLoadingState}
                          label='Work item type'
                          placeholder='Select a work item type'
                          workItemVisualMode
                          disableCloseOnSelect
                          onChange={(_event, newValue) => {
                            setSelectedWorkItemTypes(Array.isArray(newValue) ? newValue : []);
                          }}
                          noOptionsText='No work item types available'
                        />
                        <Stack
                          direction='row'
                          spacing={1}
                          flexWrap='wrap'
                        >
                          <Button
                            size='small'
                            onClick={() => {
                              setSelectedWorkItemStates([...workItemStateOptions]);
                            }}
                            disabled={workItemStateOptions.length === 0}
                          >
                            Select all states
                          </Button>
                          <Button
                            size='small'
                            onClick={() => setSelectedWorkItemStates([])}
                            disabled={selectedWorkItemStates.length === 0}
                          >
                            Clear states
                          </Button>
                        </Stack>
                        <SmartAutocomplete
                          multiple
                          showCheckbox
                          autoHighlight
                          openOnFocus
                          options={workItemStateOptions}
                          value={selectedWorkItemStates}
                          label='Work item state'
                          placeholder='Select a work item state'
                          disabled={selectedWorkItemTypes.length === 0}
                          workItemVisualMode
                          disableCloseOnSelect
                          onChange={(_event, newValue) =>
                            setSelectedWorkItemStates(Array.isArray(newValue) ? newValue : [])
                          }
                          noOptionsText={
                            selectedWorkItemTypes.length > 0
                              ? 'No states available for the selected types'
                              : 'Select at least one work item type first'
                          }
                        />
                      </Stack>
                    </Collapse>
                    <SettingsDisplay
                      title='Configured values'
                      settings={workItemFilterSummary}
                      emptyMessage='Work item filters disabled.'
                      boxProps={{ p: 0, bgcolor: 'transparent' }}
                    />
                  </Stack>
                </SectionCard>
                <SectionCard
                  title='Queries'
                  compact
                  loading={store.fetchLoadingState().sharedQueriesLoadingState}
                  loadingText='Loading queries...'
                >
                  <Stack spacing={1}>
                    <FormControlLabel
                      disabled={
                        store.fetchLoadingState().sharedQueriesLoadingState ||
                        !queryTrees.systemOverviewQueryTree ||
                        queryTrees.systemOverviewQueryTree?.length === 0
                      }
                      control={
                        <Checkbox
                          checked={includeSystemOverview}
                          onChange={(_event, checked) => {
                            setIncludeSystemOverview(checked);
                            if (!checked) setQueriesRequest((prev) => ({ ...prev, sysOverviewQuery: null }));
                          }}
                        />
                      }
                      label='Include system overview'
                    />
                    <Collapse
                      in={includeSystemOverview}
                      timeout='auto'
                      unmountOnExit
                    >
                      <QueryTree
                        data={queryTrees.systemOverviewQueryTree}
                        prevSelectedQuery={queriesRequest?.sysOverviewQuery}
                        onSelectedQuery={onSelectedSystemOverviewQuery}
                        queryType='system-overview'
                        isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                      />
                    </Collapse>
                    <FormControlLabel
                      control={
                        <Checkbox
                          disabled={
                            store.fetchLoadingState().sharedQueriesLoadingState ||
                            !queryTrees.knownBugsQueryTree ||
                            queryTrees.knownBugsQueryTree?.length === 0
                          }
                          checked={includeKnownBugs}
                          onChange={(_event, checked) => {
                            setIncludeKnownBugs(checked);
                            if (!checked) setQueriesRequest((prev) => ({ ...prev, knownBugsQuery: null }));
                          }}
                        />
                      }
                      label='Include known possible bugs'
                    />
                    <Collapse
                      in={includeKnownBugs}
                      timeout='auto'
                      unmountOnExit
                    >
                      <QueryTree
                        data={queryTrees.knownBugsQueryTree}
                        prevSelectedQuery={queriesRequest?.knownBugsQuery}
                        onSelectedQuery={onSelectedKnownBugsQuery}
                        queryType='known-bugs'
                        isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                      />
                    </Collapse>
                  </Stack>
                </SectionCard>

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
        <RestoreBackdrop open={!!(isRestoring || baseRestoring)} label='Restoring SVD selection…' />
      </>
    );
  }
);

export default ChangeTableSelector;
