import React, { useState, useEffect, useCallback } from 'react';
import { PrimaryButton } from '@fluentui/react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';
const defaultSelectedItem = {
  key: '',
  text: '',
};
const ReleaseSelector = observer(
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
    const [releaseDefinitionHistory, setReleaseDefinitionHistory] = useState([]);
    const [selectedReleaseDefinition, setSelectedReleaseDefinition] = useState(defaultSelectedItem);
    const [selectedReleaseHistoryStart, setSelectedReleaseHistoryStart] = useState(defaultSelectedItem);
    const [selectedReleaseHistoryEnd, setSelectedReleaseHistoryEnd] = useState(defaultSelectedItem);
    const [endPointReleaseHistory, setEndPointRunHistory] = useState([]);
    const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

    const handleStartPointReleaseSelect = (value, releaseDefinitionHistoryData = null) => {
      if (value.key === '') {
        setSelectedReleaseHistoryStart(defaultSelectedItem);
        return;
      }
      const currentReleaseDefinitionHistory = releaseDefinitionHistoryData || releaseDefinitionHistory;

      const releaseExists = currentReleaseDefinitionHistory.some((release) => release.id === value?.key);

      if (!releaseExists) {
        toast.warn(`Release with ID ${value?.key} not found in available releases`);
        setSelectedReleaseHistoryStart(defaultSelectedItem);
        return;
      }

      setSelectedReleaseHistoryStart(value);

      const filteredHistory = currentReleaseDefinitionHistory.filter((run) => run.id > value.key);
      const sortedHistory = [...filteredHistory].sort((a, b) => b.name.localeCompare(a.name));
      setEndPointRunHistory(sortedHistory);
    };

    const handleOnReleaseSelect = async (value) => {
      // First validate the release definition exists in the release list
      const releaseExists = store.releaseDefinitionList.some((release) => release.id === value?.key);

      if (!releaseExists) {
        console.warn(`Release definition with ID ${value?.key} not found in available releases`);
        return [];
      }

      const historyData = await store.fetchReleaseDefinitionHistory(value.key);
      setReleaseDefinitionHistory(historyData || []);
      if (value.text) {
        let convertedRelease = value.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
        store.setContextName(`release-${convertedRelease}`);
      }
      setSelectedReleaseDefinition(value);
      return historyData || [];
    };

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (!dataToRead) return;
      loadSavedData(dataToRead);
    }, [dataToRead, store.releaseDefinitionList]);

    const loadSavedData = useCallback(
      async (data) => {
        try {
          if (!validateReleaseExists(data.selectedRelease)) {
            return;
          }

          const releaseHistoryData = await handleOnReleaseSelect(data.selectedRelease);

          if (!releaseHistoryData || releaseHistoryData.length === 0) {
            toast.warn(`No release history data found for release ${data.selectedRelease.key}`);
            return;
          }

          processReleaseSelections(data, releaseHistoryData);
        } catch (error) {
          console.error('Error loading saved data:', error.message);
          toast.error(`Error loading saved data: ${error.message}`, { autoClose: false });
        }
      },
      [handleOnReleaseSelect, store.releaseDefinitionList]
    );

    const validateReleaseExists = useCallback(
      (selectedRelease) => {
        if (
          !selectedRelease ||
          !store.releaseDefinitionList.some((release) => release.id === selectedRelease.key)
        ) {
          console.warn(`Release definition with ID ${selectedRelease?.key} not found in available releases`);
          return false;
        }
        return true;
      },
      [store.releaseDefinitionList]
    );

    const processReleaseSelections = useCallback(
      (data, releaseHistoryData) => {
        const startReleaseExists = releaseHistoryData.some((release) => release.id === data.from);
        const endReleaseExists = releaseHistoryData.some((release) => release.id === data.to);

        if (startReleaseExists) {
          const selectedStartRelease = releaseHistoryData.find((release) => release.id === data.from);
          handleStartPointReleaseSelect(
            {
              key: selectedStartRelease.id,
              text: selectedStartRelease.name,
            },
            releaseHistoryData
          );

          processEndReleaseSelection(data.to, data.from, endReleaseExists, releaseHistoryData);
        } else {
          toast.warn(`Start release with ID ${data.from} not found in release history data`);
          handleStartPointReleaseSelect(defaultSelectedItem, releaseHistoryData);
          setSelectedReleaseHistoryEnd(defaultSelectedItem);
        }
      },
      [handleStartPointReleaseSelect]
    );

    const processEndReleaseSelection = useCallback(
      (endReleaseId, startReleaseId, endReleaseExists, releaseHistoryData) => {
        if (endReleaseExists && endReleaseId > startReleaseId) {
          const selectedEndRelease = releaseHistoryData.find((release) => release.id === endReleaseId);
          setSelectedReleaseHistoryEnd({
            key: selectedEndRelease.id,
            text: selectedEndRelease.name,
          });
        } else if (endReleaseExists) {
          toast.warn(`End release with ID ${endReleaseId} is not after start release ID ${startReleaseId}`);
        } else {
          toast.warn(`End release with ID ${endReleaseId} not found in release history data`);
        }
      },
      []
    );

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [selectedReleaseDefinition, selectedReleaseHistoryStart, selectedReleaseHistoryEnd]);

    function UpdateDocumentRequestObject() {
      addToDocumentRequestObject(
        {
          type: 'change-description-table',
          title: contentControlTitle,
          skin: skin,
          headingLevel: contentHeadingLevel,
          data: {
            selectedRelease: selectedReleaseDefinition,
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
          options={Array.from(store.releaseDefinitionList || [])
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
            .map((releaseDefinition) => {
              return {
                key: releaseDefinition.id,
                text: `${releaseDefinition.id} - ${releaseDefinition.name}`,
              };
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
            await handleOnReleaseSelect(newValue);
          }}
          value={selectedReleaseDefinition}
        />
        {selectedReleaseDefinition.key !== '' ? (
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
            value={selectedReleaseHistoryStart}
          />
        ) : null}
        {selectedReleaseDefinition.key !== '' && selectedReleaseHistoryStart !== defaultSelectedItem ? (
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
            value={selectedReleaseHistoryEnd}
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

export default ReleaseSelector;
