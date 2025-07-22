import React, { useCallback, useEffect, useState } from 'react';
import GitObjectRangeSelector from './GitObjectRangeSelector';
import CommitDateSelector from './CommitDateSelector';
import PipelineSelector from './PipelineSelector';
import ReleaseSelector from './ReleaseSelector';
import { observer } from 'mobx-react';
import {
  Autocomplete,
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import PullRequestSelector from './PullRequestSelector';
import QueryTree from './QueryTree';
import { toast } from 'react-toastify';
import UploadAttachmentFileButton from './UploadAttachmentFileButton';
import LinkedWiSelectionDialog from '../dialogs/LinkedWiSelectionDialog';
import SettingsDisplay from './SettingsDisplay';

const baseChangeTableDataType = [
  { key: 0, text: 'git-object-range', type: 'range' },
  { key: 1, text: 'commit-date', type: 'date' },
  { key: 2, text: 'pipeline-range', type: 'pipeline' },
  { key: 3, text: 'release-range', type: 'release' },
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
    contentControlType,
    contentControlSkin,
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
          setQueriesRequest(defaultSelectedQueriesForChangeTableSelector);
          return;
        }

        setIncludeSystemOverview(systemOverviewQuery.sysOverviewQuery);
        setIncludeKnownBugs(systemOverviewQuery.knownBugsQuery);
        onSelectedSystemOverviewQuery(systemOverviewQuery.sysOverviewQuery);
        onSelectedKnownBugsQuery(systemOverviewQuery.knownBugsQuery);
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
      const acquiredTrees = sharedQueries.acquiredTrees;
      acquiredTrees !== null
        ? setQueryTrees(() => ({
            systemOverviewQueryTree: acquiredTrees.systemOverviewQueryTree
              ? [acquiredTrees.systemOverviewQueryTree]
              : [],
            knownBugsQueryTree: acquiredTrees.knownBugsQueryTree ? [acquiredTrees.knownBugsQueryTree] : [],
          }))
        : setQueryTrees(defaultSelectedQueriesForChangeTableSelector);
    }, [sharedQueries.acquiredTrees]);

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
        toast.error('Error processing favorite data:', error);
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

    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            disabled={!queryTrees.systemOverviewQueryTree || queryTrees.systemOverviewQueryTree?.length === 0}
            control={
              <Checkbox
                checked={includeSystemOverview}
                onChange={(event, checked) => {
                  setIncludeSystemOverview(checked);
                  if (checked === false) {
                    setQueriesRequest((prev) => ({ ...prev, sysOverviewQuery: null }));
                  }
                }}
              />
            }
            label='Include System Overview'
          />
          <Collapse
            in={includeSystemOverview}
            timeout='auto'
            unmountOnExit
          >
            {queryTrees.systemOverviewQueryTree?.length > 0 && (
              <QueryTree
                data={queryTrees.systemOverviewQueryTree}
                prevSelectedQuery={queriesRequest?.sysOverviewQuery}
                onSelectedQuery={onSelectedSystemOverviewQuery}
                queryType={'system-overview'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            )}
          </Collapse>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            control={
              <Checkbox
                disabled={!queryTrees.knownBugsQueryTree || queryTrees.knownBugsQueryTree?.length === 0}
                checked={includeKnownBugs}
                onChange={(event, checked) => {
                  setIncludeKnownBugs(checked);
                  if (checked === false) {
                    setQueriesRequest((prev) => ({ ...prev, knownBugsQuery: null }));
                  }
                }}
              />
            }
            label='Include Known Possible Bugs By Query'
          />
          <Collapse
            in={includeKnownBugs}
            timeout='auto'
            unmountOnExit
          >
            {queryTrees.knownBugsQueryTree?.length > 0 && (
              <QueryTree
                data={queryTrees.knownBugsQueryTree}
                prevSelectedQuery={queriesRequest?.knownBugsQuery}
                onSelectedQuery={onSelectedKnownBugsQuery}
                queryType={'known-bugs'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            )}
          </Collapse>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: 300 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeCommittedBy}
                onChange={(event, checked) => {
                  setIncludeCommittedBy(checked);
                }}
              />
            }
            label='Include Committer'
          />
        </Box>
        <Box sx={{ my: 1, display: 'flex', flexDirection: 'column' }}>
          <UploadAttachmentFileButton
            store={store}
            onNewFileUpload={handleNewFileUploaded}
            onClear={handleClearAttachment}
            bucketName={`wiki-attachments`}
            isDisabled={!selectedTeamProject}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: 300 }}>
          <LinkedWiSelectionDialog
            prevOptions={linkedWiOptions}
            setOptions={setLinkedWiOptions}
          />
          <SettingsDisplay
            title='Linked Work Item Settings'
            settings={generateIncludedLinkedWorkItemSelection()}
            emptyMessage='No linked work item settings enabled'
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: 300 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeUnlinkedCommits}
                onChange={(event, checked) => {
                  setIncludeUnlinkedCommits(checked);
                }}
              />
            }
            label='Include Commits with Unrelated Work Items'
          />
        </Box>
        <br />
        <div>
          <div>
            <Autocomplete
              disableClearable
              style={{ marginBlock: 8, width: 300 }}
              autoHighlight
              openOnFocus
              options={baseChangeTableDataType}
              value={selectedType}
              getOptionLabel={(option) => `${option.text}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Select Base Data Type'
                  variant='outlined'
                />
              )}
              onChange={(event, newValue) => {
                setSelectedType(newValue);
              }}
            />
          </div>
          <div>
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
              //TODO: implement favorites here as well after implementing the changes
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
          </div>

          <br />
        </div>
      </>
    );
  }
);

export default ChangeTableSelector;
