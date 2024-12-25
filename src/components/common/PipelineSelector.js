import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

const defaultSelectedItem = {
  key: '',
  text: '',
};

const PipelineSelector = ({
  store,
  contentControlTitle,
  skin,
  pipelineList,
  pipelineRunHistory,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
  queriesRequest,
}) => {
  const [selectedPipeline, setSelectedPipeline] = useState(defaultSelectedItem);
  const [endPointRunHistory, setEndPointRunHistory] = useState([]);
  const [selectedPipelineRunStart, setSelectedPipelineRunStart] = useState(defaultSelectedItem);
  const [selectedPipelineRunEnd, setSelectedPipelineRunEnd] = useState(defaultSelectedItem);

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
        headingLevel: 1,
        data: {
          from: selectedPipelineRunStart.key,
          to: selectedPipelineRunEnd.key,
          rangeType: 'pipeline',
          linkTypeFilterArray: null,
          systemOverviewQuery: queriesRequest,
        },
      },
      contentControlIndex
    );
  }

  // const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

  const handleStartPointPipelineSelect = (newValue) => {
    setSelectedPipelineRunStart(newValue);
    setEndPointRunHistory(pipelineRunHistory.filter((run) => run.id > newValue.key)).sort((a, b) =>
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
        options={pipelineList
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((pipeline) => {
            return { key: pipeline.id, text: pipeline.name };
          })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select a Pipeline'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          store.fetchPipelineRunHistory(newValue.key);
          setSelectedPipeline(newValue);
        }}
      />
      {selectedPipeline.key !== '' ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={[...pipelineRunHistory]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((run) => {
              return { key: run.id, text: run.name };
            })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select start pipeline run'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            handleStartPointPipelineSelect(newValue);
          }}
        />
      ) : null}
      {selectedPipeline.key !== '' && selectedPipelineRunStart !== defaultSelectedItem ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={endPointRunHistory.map((run) => {
            return { key: run.id, text: run.name };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select end pipeline run'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedPipelineRunEnd(newValue);
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

export default PipelineSelector;
