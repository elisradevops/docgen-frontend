import React, { useEffect, useState } from 'react';
import { toJS } from 'mobx';
import CommitRangeSelector from './CommitRangeSelector';
import CommitDateSelector from './CommitDateSelector';
import PipelineSelector from './PipelineSelector';
import ReleaseSelector from './ReleaseSelector';
import { observer } from 'mobx-react';
import { Autocomplete, Box, Checkbox, Collapse, FormControlLabel, TextField } from '@mui/material';
import PullRequestSelector from './PullRequestSelector';
import QueryTree from './QueryTree';

const baseDataType = [
  // { key: 0, text: "commit-range", type: "range" },
  { key: 1, text: 'commit-date', type: 'date' },
  { key: 2, text: 'pipeline-range', type: 'pipeline' },
  { key: 3, text: 'release-range', type: 'release' },
  // { key: 4, text: "pullrequest-range", type: "pullrequest" },
];

const defaultSelectedQueries = {
  systemOverviewQueryTree: null,
};

const ChangeTableSelector = observer(
  ({
    store,
    contentControlType,
    contentControlSkin,
    contentControlTitle,
    editingMode,
    addToDocumentRequestObject,
    contentControlIndex,
    sharedQueries,
  }) => {
    const [selectedType, setselectedType] = useState('');
    const [queryTrees, setQueryTrees] = useState({
      systemOverviewQueryTree: [],
    });
    const [systemOverviewRequest, setSystemOverviewRequest] = useState(defaultSelectedQueries);
    const [includeSystemOverview, setIncludeSystemOverview] = useState(false);
    useEffect(() => {
      const { acquiredTrees } = toJS(sharedQueries);
      acquiredTrees !== null
        ? setQueryTrees(() => ({
            systemOverviewQueryTree: acquiredTrees.systemOverviewQueryTree
              ? [acquiredTrees.systemOverviewQueryTree]
              : [],
          }))
        : setQueryTrees(defaultSelectedQueries);
    }, [sharedQueries.acquiredTrees]);

    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            control={
              <Checkbox
                value={includeSystemOverview}
                onChange={(event, checked) => {
                  setIncludeSystemOverview(checked);
                  if (checked === false) {
                    setSystemOverviewRequest(defaultSelectedQueries);
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
            {queryTrees.systemOverviewQueryTree.length > 0 && (
              <QueryTree
                data={queryTrees.systemOverviewQueryTree}
                onSelectedQuery={setSystemOverviewRequest}
                queryType={'system-overview'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            )}
          </Collapse>
        </Box>
        <br />
        <div>
          <div>
            <Autocomplete
              disableClearable
              style={{ marginBlock: 8, width: 300 }}
              autoHighlight
              openOnFocus
              options={baseDataType}
              getOptionLabel={(option) => `${option.text}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Select Base Data Type'
                  variant='outlined'
                />
              )}
              onChange={(event, newValue) => {
                setselectedType(newValue.type);
              }}
            />
          </div>
          <div>
            {selectedType === 'range' ? (
              <CommitRangeSelector
                store={store}
                contentControlTitle={contentControlTitle}
                skin='change-table'
                repoList={store.repoList}
                branchesList={store.branchesList}
                gitRepoCommits={store.gitRepoCommits}
                editingMode={editingMode}
                addToDocumentRequestObject={addToDocumentRequestObject}
                contentControlIndex={contentControlIndex}
                systemOverviewRequest={systemOverviewRequest}
              />
            ) : null}
            {selectedType === 'date' ? (
              <CommitDateSelector
                store={store}
                contentControlTitle={contentControlTitle}
                skin='change-table'
                repoList={store.repoList}
                branchesList={store.branchesList}
                editingMode={editingMode}
                addToDocumentRequestObject={addToDocumentRequestObject}
                contentControlIndex={contentControlIndex}
                systemOverviewRequest={systemOverviewRequest}
              />
            ) : null}
            {selectedType === 'pipeline' ? (
              <PipelineSelector
                store={store}
                contentControlTitle={contentControlTitle}
                skin='change-table'
                pipelineList={store.pipelineList}
                pipelineRunHistory={store.pipelineRunHistory}
                editingMode={editingMode}
                addToDocumentRequestObject={addToDocumentRequestObject}
                contentControlIndex={contentControlIndex}
                systemOverviewRequest={systemOverviewRequest}
              />
            ) : null}
            {selectedType === 'release' ? (
              <ReleaseSelector
                store={store}
                contentControlTitle={contentControlTitle}
                skin='change-table'
                releaseDefinitionList={store.releaseDefinitionList}
                releaseDefinitionHistory={store.releaseDefinitionHistory}
                editingMode={editingMode}
                addToDocumentRequestObject={addToDocumentRequestObject}
                contentControlIndex={contentControlIndex}
                systemOverviewRequest={systemOverviewRequest}
              />
            ) : null}
            {selectedType === 'pullrequest' ? (
              <PullRequestSelector
                store={store}
                contentControlTitle={contentControlTitle}
                skin='change-table'
                repoList={store.repoList}
                pullRequests={store.pullRequestList}
                editingMode={editingMode}
                addToDocumentRequestObject={addToDocumentRequestObject}
                contentControlIndex={contentControlIndex}
                systemOverviewRequest={systemOverviewRequest}
              />
            ) : null}
          </div>
          <br />
          <br />
        </div>
      </>
    );
  }
);

export default ChangeTableSelector;
