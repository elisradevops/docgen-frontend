import React, { useState, useEffect, useCallback } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';

const defaultSelectedItem = {
  key: '',
  text: '',
};

const PipelineSelector = observer(
  ({
    store,
    contentControlTitle,
    skin,
    editingMode,
    addToDocumentRequestObject,
    contentControlIndex,
    queriesRequest,
    dataToRead,
  }) => {
    const [pipelineRunHistory, setPipelineRunHistory] = useState([]);
    const [selectedPipeline, setSelectedPipeline] = useState(defaultSelectedItem);
    const [endPointRunHistory, setEndPointRunHistory] = useState([]);
    const [selectedPipelineRunStart, setSelectedPipelineRunStart] = useState(defaultSelectedItem);
    const [selectedPipelineRunEnd, setSelectedPipelineRunEnd] = useState(defaultSelectedItem);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [
      pipelineRunHistory,
      selectedPipeline,
      selectedPipelineRunStart,
      selectedPipelineRunEnd,
      store.attachmentWikiUrl,
      editingMode,
      UpdateDocumentRequestObject,
    ]);

    const handleOnPipelineSelect = async (value) => {
      // First validate the pipeline exists in the pipeline list
      const pipelineExists = store.pipelineList.some((pipeline) => pipeline.id === value?.key);

      if (!pipelineExists) {
        toast.warn(`Pipeline with ID ${value?.key} not found in available pipelines`);
        return [];
      }

      // Proceed with fetching pipeline data
      const pipelineData = await store.fetchPipelineRunHistory(value.key);
      setPipelineRunHistory(pipelineData || []);

      if (value.text) {
        let convertedPipeline = value.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
        store.setContextName(`pipeline-${convertedPipeline}`);
      }

      setSelectedPipeline(value);
      return pipelineData || []; // Return the pipeline data or empty array
    };

    const handleStartPointPipelineSelect = (newValue, runHistoryData = null) => {
      // Validate newValue exists in the run history
      const currentRunHistoryList = runHistoryData || pipelineRunHistory;
      const runExists = currentRunHistoryList.some((run) => run.id === newValue?.key);

      if (!runExists) {
        toast.warn(`Pipeline run with ID ${newValue?.key} not found in pipeline history`);
        // Optionally set to first available run or do nothing
        if (currentRunHistoryList.length > 0) {
          const firstRun = currentRunHistoryList[0];
          newValue = {
            key: firstRun.id,
            text: firstRun.name,
          };
        } else {
          return; // No valid runs available
        }
      }

      setSelectedPipelineRunStart(newValue);

      // Filter runs for end point selection (only runs after selected start point)
      const filteredHistory = [...currentRunHistoryList].filter((run) => run.id > newValue.key);

      // Create a new array for sorting to avoid MobX errors
      const sortedHistory = [...filteredHistory].sort((a, b) => b.name.localeCompare(a.name));

      setEndPointRunHistory(sortedHistory);
    };

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (!dataToRead) return;
      loadSavedData(dataToRead);
    }, [dataToRead, store.pipelineList]);

    const loadSavedData = useCallback(
      async (data) => {
        try {
          if (!validatePipelineExists(data.selectedPipeline)) {
            return;
          }

          const pipelineData = await handleOnPipelineSelect(data.selectedPipeline);

          if (!pipelineData || pipelineData.length === 0) {
            toast.warn(`No pipeline run data found for pipeline ${data.selectedPipeline.key}`);
            return;
          }

          await processRunSelections(data, pipelineData);
        } catch (error) {
          toast.error(`Error loading pipeline data: ${error.message}`);
        }
      },
      [handleOnPipelineSelect]
    );

    const validatePipelineExists = useCallback(
      (selectedPipeline) => {
        if (
          !selectedPipeline ||
          !store.pipelineList.some((pipeline) => pipeline.id === selectedPipeline.key)
        ) {
          toast.warn(`Pipeline with ID ${selectedPipeline?.key} not found in available pipelines`);
          return false;
        }
        return true;
      },
      [store.pipelineList]
    );

    const processRunSelections = useCallback(
      async (data, pipelineData) => {
        const startRunExists = pipelineData.some((run) => run.id === data.from);
        const endRunExists = pipelineData.some((run) => run.id === data.to);

        if (startRunExists) {
          const selectedStartPipelineRun = pipelineData.find((run) => run.id === data.from);
          await handleStartPointPipelineSelect(
            {
              key: selectedStartPipelineRun.id,
              text: selectedStartPipelineRun.name,
            },
            pipelineData
          );

          processEndRunSelection(data.to, data.from, endRunExists, pipelineData);
        } else {
          toast.warn(`Start run with ID ${data.from} not found in pipeline data`);
          handleStartPointPipelineSelect(defaultSelectedItem, pipelineData);
          setSelectedPipelineRunEnd(defaultSelectedItem);
        }
      },
      [handleStartPointPipelineSelect]
    );

    const processEndRunSelection = useCallback((endRunId, startRunId, endRunExists, pipelineData) => {
      if (endRunExists && endRunId > startRunId) {
        const selectedEndPipeline = pipelineData.find((run) => run.id === endRunId);
        setSelectedPipelineRunEnd({
          key: selectedEndPipeline.id,
          text: selectedEndPipeline.name,
        });
      } else if (endRunExists) {
        toast.warn(`End run with ID ${endRunId} is not after start run ID ${startRunId}`);
      } else {
        toast.warn(`End run with ID ${endRunId} not found in pipeline data`);
      }
    }, []);

    function UpdateDocumentRequestObject() {
      addToDocumentRequestObject(
        {
          type: 'change-description-table',
          title: contentControlTitle,
          skin: skin,
          headingLevel: 1,
          data: {
            selectedPipeline: selectedPipeline,
            from: selectedPipelineRunStart.key,
            to: selectedPipelineRunEnd.key,
            rangeType: 'pipeline',
            linkTypeFilterArray: null,
            systemOverviewQuery: queriesRequest,
            attachmentWikiUrl: store.attachmentWikiUrl,
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
          options={Array.from(store.pipelineList || [])
            .slice() // Create a copy first
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
            .map((pipeline) => {
              return { key: pipeline.id, text: `${pipeline.id} - ${pipeline.name}` };
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
            await handleOnPipelineSelect(newValue);
          }}
          value={selectedPipeline}
        />
        {selectedPipeline.key !== '' ? (
          <Autocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={[...pipelineRunHistory].map((run) => {
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
            value={selectedPipelineRunStart}
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
            value={selectedPipelineRunEnd}
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
  }
);
export default PipelineSelector;
