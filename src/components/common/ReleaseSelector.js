import React, { useState, useEffect, useCallback } from 'react';
import { PrimaryButton } from '@fluentui/react';
import SmartAutocomplete from './SmartAutocomplete';
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
    linkedWiOptions,
    includeCommittedBy,
    includeUnlinkedCommits,
  }) => {
    const [releaseDefinitionHistory, setReleaseDefinitionHistory] = useState([]);
    const [selectedReleaseDefinition, setSelectedReleaseDefinition] = useState(defaultSelectedItem);
    const [selectedReleaseHistoryStart, setSelectedReleaseHistoryStart] = useState(defaultSelectedItem);
    const [selectedReleaseHistoryEnd, setSelectedReleaseHistoryEnd] = useState(defaultSelectedItem);
    const [endPointReleaseHistory, setEndPointRunHistory] = useState([]);
    const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

    const handleStartPointReleaseSelect = useCallback(
      (value, releaseDefinitionHistoryData = null) => {
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
      },
      [releaseDefinitionHistory]
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

    const handleOnReleaseSelect = useCallback(
      async (value) => {
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
      },
      [store]
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
      [handleStartPointReleaseSelect, processEndReleaseSelection]
    );

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
      [handleOnReleaseSelect, processReleaseSelections, validateReleaseExists]
    );

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (!dataToRead) return;
      loadSavedData(dataToRead);
    }, [dataToRead, loadSavedData, store.releaseDefinitionList]);

    const UpdateDocumentRequestObject = useCallback(() => {
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
            attachmentWikiUrl: store.attachmentWikiUrl,
            linkedWiOptions: linkedWiOptions,
            includeCommittedBy: includeCommittedBy,
            includeUnlinkedCommits: includeUnlinkedCommits,
          },
        },
        contentControlIndex
      );
    }, [
      addToDocumentRequestObject,
      contentControlTitle,
      skin,
      contentHeadingLevel,
      selectedReleaseDefinition,
      selectedReleaseHistoryStart.key,
      selectedReleaseHistoryEnd.key,
      queriesRequest,
      store.attachmentWikiUrl,
      linkedWiOptions,
      includeCommittedBy,
      includeUnlinkedCommits,
      contentControlIndex,
    ]);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [
      selectedReleaseDefinition,
      selectedReleaseHistoryStart,
      selectedReleaseHistoryEnd,
      store.attachmentWikiUrl,
      editingMode,
      UpdateDocumentRequestObject,
      includeUnlinkedCommits,
    ]);

    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!selectedReleaseDefinition?.key) {
        isValid = false;
        message = 'Select a release definition';
      } else if (!selectedReleaseHistoryStart?.key) {
        isValid = false;
        message = 'Select start release';
      } else if (!selectedReleaseHistoryEnd?.key) {
        isValid = false;
        message = 'Select end release';
      } else if (Number(selectedReleaseHistoryEnd?.key) <= Number(selectedReleaseHistoryStart?.key)) {
        isValid = false;
        message = 'End release must be after start release';
      }
      try {
        store.setValidationState(contentControlIndex, 'release', { isValid, message });
      } catch {}
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'release');
        } catch {}
      };
    }, [
      selectedReleaseDefinition?.key,
      selectedReleaseHistoryStart?.key,
      selectedReleaseHistoryEnd?.key,
      store,
      contentControlIndex,
    ]);

    return (
      <div>
        {/* <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={headingLevelOptions}
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
        <SmartAutocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          loading={store.loadingState.releaseDefinitionLoadingState}
          options={Array.from(store.releaseDefinitionList || [])
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
            .map((releaseDefinition) => {
              return {
                key: releaseDefinition.id,
                text: `${releaseDefinition.id} - ${releaseDefinition.name}`,
              };
            })}
          label='Select a Release'
          onChange={async (event, newValue) => {
            await handleOnReleaseSelect(newValue);
          }}
          value={selectedReleaseDefinition}
        />
        {selectedReleaseDefinition.key !== '' ? (
          <SmartAutocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={[...releaseDefinitionHistory].map((run) => {
              return { key: run.id, text: run.name };
            })}
            label='Select start release'
            onChange={async (event, newValue) => {
              handleStartPointReleaseSelect(newValue);
            }}
            value={selectedReleaseHistoryStart}
          />
        ) : null}
        {selectedReleaseDefinition.key !== '' && selectedReleaseHistoryStart !== defaultSelectedItem ? (
          <SmartAutocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={endPointReleaseHistory.map((run) => {
              return { key: run.id, text: run.name };
            })}
            label='Select end release'
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
