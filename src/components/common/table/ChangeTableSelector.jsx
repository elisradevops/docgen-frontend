import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import GitObjectRangeSelector from '../selectors/GitObjectRangeSelector';
import CommitDateSelector from '../selectors/CommitDateSelector';
import PipelineSelector from '../selectors/PipelineSelector';
import ReleaseSelector from '../selectors/ReleaseSelector';
import { observer } from 'mobx-react';
import { Box, Checkbox, Collapse, FormControlLabel, Typography, Grid, Stack } from '@mui/material';
import SmartAutocomplete from '../SmartAutocomplete';
import PullRequestSelector from '../selectors/PullRequestSelector';
import QueryTree from '../QueryTree';
import { toast } from 'react-toastify'; 
import UploadAttachmentFileButton from '../UploadAttachmentFileButton';
import LinkedWiSelectionDialog from '../../dialogs/LinkedWiSelectionDialog';
import SettingsDisplay from '../SettingsDisplay';
import SectionCard from '../../layout/SectionCard';

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
    const [linkedWiOptions, setLinkedWiOptions] = useState(defaultLinkedWiOptions);
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

    //Reading the loaded selected favorite data
    useEffect(() => {
      // Early return if no favorite selected
      const selectedFavorite = store.selectedFavorite;
      if (!selectedFavorite?.dataToSave) return;

      const { dataToSave } = selectedFavorite;

      try {
        // Extract and process system overview query data
        processSystemOverviewData(dataToSave.systemOverviewQuery);

        processLinkedWiOptions(dataToSave.linkedWiOptions);
        setIncludeCommittedBy(dataToSave.includeCommittedBy || false);
        setIncludeUnlinkedCommits(dataToSave.includeUnlinkedCommits || false);

        // Process range type selection
        processRangeTypeSelection(dataToSave);

        // Set the loaded data
        setLoadedData(dataToSave);
      } catch (error) {
        toast.error(`Error processing favorite data: ${error?.message ?? 'Unknown error'}`);
        setQueriesRequest(defaultSelectedQueriesForChangeTableSelector);
      }
    }, [
      processLinkedWiOptions,
      processRangeTypeSelection,
      processSystemOverviewData,
      store.selectedFavorite,
    ]); // Only depend on the selected favorite

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
            `Include ${
              linkedWiOptions.linkedWiTypes !== 'reqOnly' ? 'Feature Only' : 'Requirement Only'
            } linked items`
          );
        } else {
          settings.push('Include both Feature and Requirement linked items');
        }

        if (linkedWiOptions?.linkedWiRelationship !== 'both') {
          settings.push(
            `Include ${
              linkedWiOptions.linkedWiRelationship !== 'affectsOnly' ? 'Affects Only' : 'Covers Only'
            } Related items`
          );
        } else {
          settings.push('Include both Affects and Covers related items');
        }
      }

      return settings;
    };

    const linkedWiSummary = generateIncludedLinkedWorkItemSelection();

    const baseSummary = selectedType?.text
      ? `Base type: ${selectedType.text}`
      : 'Pick a base data type to configure the range.';

    return (
      <Stack spacing={1.5}>
        <Grid container spacing={1.5} alignItems='stretch'>
          <Grid size={{ xs: 12, lg: 8 }} sx={{ minWidth: 0 }}>
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
                  />
                ) : null}

                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {baseSummary}
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems='flex-start'>
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

          <Grid size={{ xs: 12, lg: 4 }} sx={{ minWidth: 0 }}>
            <Stack spacing={1.5} sx={{ minHeight: '100%' }}>
              <SectionCard title='Queries' compact>
                <Stack spacing={1}>
                  <FormControlLabel
                    disabled={!queryTrees.systemOverviewQueryTree || queryTrees.systemOverviewQueryTree?.length === 0}
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
                  <Collapse in={includeSystemOverview} timeout='auto' unmountOnExit>
                    {queryTrees.systemOverviewQueryTree?.length > 0 ? (
                      <QueryTree
                        data={queryTrees.systemOverviewQueryTree}
                        prevSelectedQuery={queriesRequest?.sysOverviewQuery}
                        onSelectedQuery={onSelectedSystemOverviewQuery}
                        queryType='system-overview'
                        isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                      />
                    ) : null}
                  </Collapse>
                  <FormControlLabel
                    control={
                      <Checkbox
                        disabled={!queryTrees.knownBugsQueryTree || queryTrees.knownBugsQueryTree?.length === 0}
                        checked={includeKnownBugs}
                        onChange={(_event, checked) => {
                          setIncludeKnownBugs(checked);
                          if (!checked) setQueriesRequest((prev) => ({ ...prev, knownBugsQuery: null }));
                        }}
                      />
                    }
                    label='Include known possible bugs'
                  />
                  <Collapse in={includeKnownBugs} timeout='auto' unmountOnExit>
                    {queryTrees.knownBugsQueryTree?.length > 0 ? (
                      <QueryTree
                        data={queryTrees.knownBugsQueryTree}
                        prevSelectedQuery={queriesRequest?.knownBugsQuery}
                        onSelectedQuery={onSelectedKnownBugsQuery}
                        queryType='known-bugs'
                        isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                      />
                    ) : null}
                  </Collapse>
                </Stack>
              </SectionCard>

              <SectionCard title='Wiki File' compact>
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
                compact
                actions={
                  <LinkedWiSelectionDialog prevOptions={linkedWiOptions} setOptions={setLinkedWiOptions} />
                }
              >
                <Stack spacing={1.25}>
                  <SettingsDisplay
                    title='Configured values'
                    settings={linkedWiSummary}
                    emptyMessage='No linked work item settings enabled.'
                    boxProps={{ p: 0, bgcolor: 'transparent' }}
                  />
                </Stack>
              </SectionCard>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    );
  }
);

export default ChangeTableSelector;
