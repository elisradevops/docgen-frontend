import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

const PipelineSelector = ({
  store,
  contentControlTitle,
  skin,
  pipelineList,
  pipelineRunHistory,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
}) => {
  const [selectedPipeline, setSelectedPipeline] = useState({
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
          from: selectedPipelineRunStart.key,
          to: selectedPipelineRunEnd.key,
          rangeType: 'pipeline',
          linkTypeFilterArray: null,
        },
      },
      contentControlIndex
    );
  }

  const [selectedPipelineRunStart, setSelectedPipelineRunStart] = useState({
    key: '',
    text: '',
  });

  const [selectedPipelineRunEnd, setSelectedPipelineRunEnd] = useState({
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
        options={pipelineList.map((pipeline) => {
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
          options={pipelineRunHistory.map((run) => {
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
            setSelectedPipelineRunStart(newValue);
          }}
        />
      ) : null}
      {selectedPipeline.key !== '' ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={pipelineRunHistory.map((run) => {
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
