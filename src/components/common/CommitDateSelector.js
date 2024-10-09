import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

const CommitDateSelector = ({
  store,
  contentControlTitle,
  skin,
  repoList,
  branchesList,
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

  const [selectedStartDate, setSelectedStartDate] = useState(new Date());

  const [selectedEndDate, setSelectedEndDate] = useState(new Date());

  const [includePullRequests, setIncludePullRequests] = useState(false);

  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

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
          from: selectedStartDate,
          to: selectedEndDate,
          rangeType: 'date',
          linkTypeFilterArray: null,
          branchName: selectedBranch.key,
          includePullRequests: includePullRequests, // Added this line
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
        options={headingLevelOptions}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select a Heading level'
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
            setSelectedBranch(newValue);
          }}
        />
      ) : null}

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label='StartDate'
          disableFuture
          value={selectedStartDate}
          onChange={setSelectedStartDate}
        />

        <DatePicker
          label='EndDate'
          disableFuture
          value={selectedEndDate}
          onChange={setSelectedEndDate}
        />
      </LocalizationProvider>
      <br />
      <br />

      <FormControlLabel
        control={
          <Checkbox
            checked={includePullRequests}
            onChange={(event, checked) => {
              setIncludePullRequests(checked);
            }}
          />
        }
        label='Only Pull Requests'
      />

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

export default CommitDateSelector;
