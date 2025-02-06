import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
const defaultSelectedItem = {
  key: '',
  text: '',
};
const ReleaseSelector = ({
  store,
  contentControlTitle,
  skin,
  releaseDefinitionList,
  releaseDefinitionHistory,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
  queriesRequest,
}) => {
  const [SelectedReleaseDefinition, setSelectedReleaseDefinition] = useState(defaultSelectedItem);
  const [selectedReleaseHistoryStart, setSelectedReleaseHistoryStart] = useState(defaultSelectedItem);
  const [selectedReleaseHistoryEnd, setSelectedReleaseHistoryEnd] = useState(defaultSelectedItem);
  const [endPointReleaseHistory, setEndPointRunHistory] = useState([]);
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
          from: selectedReleaseHistoryStart.key,
          to: selectedReleaseHistoryEnd.key,
          rangeType: 'release',
          linkTypeFilterArray: null,
          systemOverviewQuery: queriesRequest,
        },
      },
      contentControlIndex
    );
  }

  const handleStartPointReleaseSelect = (newValue) => {
    setSelectedReleaseHistoryStart(newValue);
    setEndPointRunHistory(releaseDefinitionHistory.filter((run) => run.id > newValue.key)).sort((a, b) =>
      b.name.localeCompare(a.name)
    );
  };

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
            label='Select an Heading level'
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
        options={releaseDefinitionList
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((releaseDefinition) => {
            return { key: releaseDefinition.id, text: releaseDefinition.name };
          })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select a Release'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          setSelectedReleaseDefinition(newValue);
          if (newValue.text) {
            let convertedRelease = newValue.text.replace(/\s/g, '_');
            store.setContextName(`release-${convertedRelease}`);
          }
          store.fetchReleaseDefinitionHistory(newValue.key);
        }}
      />
      {SelectedReleaseDefinition.key !== '' ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={[...releaseDefinitionHistory].map((run) => {
            return { key: run.id, text: run.name };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select start release'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            handleStartPointReleaseSelect(newValue);
          }}
        />
      ) : null}
      {SelectedReleaseDefinition.key !== '' && selectedReleaseHistoryStart !== defaultSelectedItem ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={endPointReleaseHistory.map((run) => {
            return { key: run.id, text: run.name };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select end release'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedReleaseHistoryEnd(newValue);
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

export default ReleaseSelector;
