import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
// import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { Grid } from '@mui/material';

const CommitDateSelector = ({
  store,
  contentControlTitle,
  skin,
  repoList,
  branchesList,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
  queriesRequest,
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
  const [includeChangeDescription, setIncludeChangeDescription] = useState(false);
  const [includeCommittedBy, setIncludeCommittedBy] = useState(false);

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
          includeChangeDescription: includeChangeDescription,
          includeCommittedBy: includeCommittedBy,
          systemOverviewQuery: queriesRequest,
        },
      },
      contentControlIndex
    );
  }

  return (
    <div>
      {/* <Autocomplete
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
      /> */}

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
        <Grid
          container
          spacing={2}
        >
          <Grid
            item
            xs={12}
          >
            <DateTimePicker
              label='Start Date'
              disableFuture
              value={selectedStartDate}
              onChange={setSelectedStartDate}
            />
          </Grid>
          <Grid
            item
            xs={12}
          >
            <DateTimePicker
              label='End Date'
              disableFuture
              value={selectedEndDate}
              onChange={setSelectedEndDate}
            />
          </Grid>
        </Grid>
      </LocalizationProvider>

      <div>
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
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeChangeDescription}
              onChange={(event, checked) => {
                setIncludeChangeDescription(checked);
              }}
            />
          }
          label='Include Description'
        />
      </div>

      <div>
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
      </div>

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

export default CommitDateSelector;
