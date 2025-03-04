import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { Grid, Divider, TextField, Autocomplete, Typography, Tooltip } from '@mui/material';
import logger from '../../utils/logger';
const gitObjType = [
  { key: 'tag', text: 'Tags' },
  { key: 'branch', text: 'Branches' },
  { key: 'commit', text: 'Commits' },
];

const defaultGitRefState = {
  source: { gitObjType: { key: '', text: '' }, gitObjRef: { key: '', text: '' } },
  target: { gitObjType: { key: '', text: '' }, gitObjRef: { key: '', text: '' } },
};

const GitObjectRangeSelector = ({
  store,
  contentControlTitle,
  skin,
  repoList,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
  queriesRequest,
}) => {
  const [selectedRepo, setSelectedRepo] = useState({
    key: '',
    text: '',
  });

  const [gitRefState, setGitRefState] = useState(defaultGitRefState);

  const [sourceGitRefOptions, setSourceGitRefOptions] = useState([]);
  const [targetGitRefOptions, setTargetGitRefOptions] = useState([]);

  useEffect(() => {
    if (editingMode === false) {
      UpdateDocumentRequestObject();
    }
  });

  useEffect(() => {
    // Reset the git ref state when a new repo is selected
    if (selectedRepo.key !== '') {
      setGitRefState(defaultGitRefState);
    }
  }, [selectedRepo]);

  function UpdateDocumentRequestObject() {
    if (selectedRepo.text) {
      let convertedText = selectedRepo.text.replace(/\./g, '-').replace(/\s/g, '_');
      store.setContextName(`git-object-range-${convertedText}`);
    }
    addToDocumentRequestObject(
      {
        type: 'change-description-table',
        title: contentControlTitle,
        skin: skin,
        headingLevel: 1,
        data: {
          repoId: selectedRepo.key,
          from: { type: gitRefState.source.gitObjType.key, ref: gitRefState.source.gitObjRef.key },
          to: { type: gitRefState.target.gitObjType.key, ref: gitRefState.target.gitObjRef.key },
          rangeType: 'gitObjectRange',
          linkTypeFilterArray: null,
          systemOverviewQuery: queriesRequest,
        },
      },
      contentControlIndex
    );
  }

  return (
    <div>
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={repoList.map((repo) => {
          return { key: repo.id, text: repo.name };
        })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select a Repo'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          setSelectedRepo(newValue);
        }}
      />
      {selectedRepo.key !== '' && (
        <Grid
          container
          spacing={1}
        >
          {/* Source */}
          <Grid
            item
            xs={12}
          >
            <Divider
              aria-hidden='true'
              textAlign='left'
            >
              <Typography>From</Typography>
            </Divider>
          </Grid>
          <Grid
            item
            xs={4}
          >
            <Autocomplete
              disableClearable
              autoHighlight
              openOnFocus
              size='small'
              options={gitObjType}
              value={gitRefState.source.gitObjType}
              getOptionLabel={(option) => `${option.text}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Object Type'
                  variant='outlined'
                />
              )}
              onChange={async (event, newValue) => {
                let objects = [];
                if (newValue.key !== 'commit') {
                  objects = await store.fetchGitObjectRefsByType(selectedRepo.text, newValue.key);
                } else {
                  objects = await store.fetchGitRepoCommits(selectedRepo.text);
                }
                setGitRefState({
                  ...gitRefState,
                  source: {
                    gitObjType: newValue,
                    gitObjRef: defaultGitRefState.source.gitObjRef,
                  },
                });
                setSourceGitRefOptions(objects);
              }}
            />
          </Grid>
          <Grid
            item
            xs={8}
          >
            <Autocomplete
              disableClearable
              autoFocus
              openOnFocus
              size='small'
              value={gitRefState.source.gitObjRef}
              options={sourceGitRefOptions.map((ref) => {
                return { key: ref.value, text: ref.name };
              })}
              getOptionLabel={(option) => `${option.text}`}
              renderOption={(props, option) => (
                <Tooltip
                  title={option.text}
                  placement='right'
                  arrow
                >
                  <li {...props}>{option.text}</li>
                </Tooltip>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Ref'
                  variant='outlined'
                />
              )}
              onChange={async (event, newValue) => {
                setGitRefState({
                  ...gitRefState,
                  source: {
                    gitObjType: gitRefState.source.gitObjType,
                    gitObjRef: newValue,
                  },
                });
              }}
            />
          </Grid>

          {/* Target */}
          <Grid
            item
            xs={12}
          >
            <Divider
              aria-hidden='true'
              textAlign='left'
            >
              <Typography>To</Typography>
            </Divider>
          </Grid>
          <Grid
            item
            xs={4}
          >
            <Autocomplete
              disableClearable
              autoHighlight
              openOnFocus
              options={gitObjType}
              value={gitRefState.target.gitObjType}
              size='small'
              getOptionLabel={(option) => `${option.text}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size='small'
                  label='Object Type'
                  variant='outlined'
                />
              )}
              onChange={async (event, newValue) => {
                let objects = [];
                if (newValue.key !== 'commit') {
                  objects = await store.fetchGitObjectRefsByType(selectedRepo.text, newValue.key);
                } else {
                  objects = await store.fetchGitRepoCommits(selectedRepo.text);
                }
                setGitRefState({
                  ...gitRefState,
                  target: {
                    gitObjType: newValue,
                    gitObjRef: defaultGitRefState.target.gitObjRef,
                  },
                });
                setTargetGitRefOptions(objects);
              }}
            />
          </Grid>
          <Grid
            item
            xs={8}
          >
            <Autocomplete
              disableClearable
              autoFocus
              openOnFocus
              size='small'
              options={targetGitRefOptions.map((ref) => {
                return { key: ref.value, text: ref.name };
              })}
              value={gitRefState.target.gitObjRef}
              getOptionLabel={(option) => `${option.text}`}
              renderOption={(props, option) => (
                <Tooltip
                  title={option.text}
                  placement='right'
                  arrow
                >
                  <li {...props}>{option.text}</li>
                </Tooltip>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Ref'
                  variant='outlined'
                />
              )}
              onChange={async (event, newValue) => {
                setGitRefState({
                  ...gitRefState,
                  target: {
                    gitObjType: gitRefState.target.gitObjType,
                    gitObjRef: newValue,
                  },
                });
              }}
            />
          </Grid>
        </Grid>
      )}

      <br />
      <br />
      {editingMode ? (
        <PrimaryButton
          text='Add Content To Document'
          onClick={() => {
            UpdateDocumentRequestObject();
          }}
        />
      ) : null}
    </div>
  );
};

export default GitObjectRangeSelector;
