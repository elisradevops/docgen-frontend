import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';

const CommitRangeSelector = ({
  store,
  contentControlTitle,
  skin,
  repoList,
  branchesList,
  gitRepoCommits,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
}) => {
  const [selectedRepo, setSelectedRepo] = useState({
    key: '',
    text: '',
  });

  const [selectedBranch, setSelectedBranch] = useState({
    key: '',
    text: '',
  });

  useEffect(() => {
    if (editingMode === false) {
      UpdateDocumentRequestObject();
    }
  });

  function UpdateDocumentRequestObject() {
    addToDocumentRequestObject(
      {
        type: 'change-description-table',
        title: contentControlTitle,
        skin: skin,
        headingLevel: contentHeadingLevel,
        data: {
          repoId: selectedRepo.key,
          from: selectedStartCommit.key,
          to: selectedEndCommit.key,
          rangeType: 'commitSha',
          linkTypeFilterArray: null,
          branchName: selectedBranch.key,
        },
      },
      contentControlIndex
    );
  }

  const [selectedStartCommit, setSelectedStartCommit] = useState({
    key: '',
    text: '',
  });

  const [selectedEndCommit, setSelectedEndCommit] = useState({
    key: '',
    text: '',
  });

  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

  return (
    <div>
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={headingLevelOptions}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select an Heading level'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          setContentHeadingLevel(newValue.key);
        }}
      />
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
          store.fetchGitRepoBrances(newValue.key);
          setSelectedRepo(newValue);
        }}
      />

      {selectedRepo.key !== '' ? (
        <Tooltip
          title='Select branch.'
          arrow
          placement='right'
        >
          <Autocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={branchesList.map((branch) => {
              let splitName = branch.name.split('/');
              let indexAfterHeads = splitName.indexOf('heads') + 1;
              let elementsAfterHeads = splitName.slice(indexAfterHeads).join('/');
              return { key: elementsAfterHeads, text: elementsAfterHeads };
            })}
            getOptionLabel={(option) => `${option.text}`}
            renderInput={(params) => (
              <TextField
                {...params}
                label='Select a branch'
                variant='outlined'
              />
            )}
            onChange={async (event, newValue) => {
              store.fetchGitRepoCommits(selectedRepo.key, newValue.key);
              setSelectedBranch(newValue);
            }}
          />
        </Tooltip>
      ) : null}

      {selectedBranch.key !== '' ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={gitRepoCommits
            .slice()
            .reverse()
            .map((commit) => {
              return {
                key: commit.commitId,
                text: `(${commit.commitId.substring(0, 4)}) - ${commit.comment}`,
              };
            })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select Oldest Commit'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedStartCommit(newValue);
          }}
        />
      ) : null}

      {selectedBranch.key !== '' ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={gitRepoCommits.map((commit) => {
            return { key: commit.commitId, text: `(${commit.commitId.substring(0, 4)}) - ${commit.comment}` };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select Newest Commit'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedEndCommit(newValue);
          }}
        />
      ) : null}

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

export default CommitRangeSelector;
