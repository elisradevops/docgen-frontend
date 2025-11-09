import React, { useState, useEffect, useCallback, useRef } from 'react';

import SmartAutocomplete from '../SmartAutocomplete';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';
import { Grid, Button, FormLabel, RadioGroup, Radio, FormControlLabel, Typography, Stack, Tooltip, IconButton, Box } from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
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
    replaceTaskWithParent,
    workItemFilterOptions,
    isRestoring,
    onRestored,
  }) => {
    const [releaseDefinitionHistory, setReleaseDefinitionHistory] = useState([]);
    const [selectedReleaseDefinition, setSelectedReleaseDefinition] = useState(defaultSelectedItem);
    const [selectedReleaseHistoryStart, setSelectedReleaseHistoryStart] = useState(defaultSelectedItem);
    const [selectedReleaseHistoryEnd, setSelectedReleaseHistoryEnd] = useState(defaultSelectedItem);
    const [endPointReleaseHistory, setEndPointRunHistory] = useState([]);
    const [compareMode, setCompareMode] = useState('consecutive');
    const restoreTokenRef = useRef(null);

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

    const updateContextName = useCallback(
      (releaseDefinitionText, targetReleaseText) => {
        if (!releaseDefinitionText) return;

        let contextParts = [];
        let convertedRelease = releaseDefinitionText.trim().replace(/\./g, '-').replace(/\s+/g, '_');
        contextParts.push(`release-${convertedRelease}`);

        if (targetReleaseText) {
          let convertedTargetRelease = targetReleaseText.trim().replace(/\./g, '-').replace(/\s+/g, '_');
          contextParts.push(convertedTargetRelease);
        }

        store.setContextName(contextParts.join('-'));
      },
      [store]
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

        // When changing the release definition, clear previously selected range
        if (value?.key !== selectedReleaseDefinition?.key) {
          setSelectedReleaseHistoryStart(defaultSelectedItem);
          setSelectedReleaseHistoryEnd(defaultSelectedItem);
          setEndPointRunHistory([]);
        }

        setSelectedReleaseDefinition(value);
        return historyData || [];
      },
      [store, selectedReleaseDefinition]
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

          if (endReleaseExists && data.to > data.from) {
            const selectedEndRelease = releaseHistoryData.find((release) => release.id === data.to);
            setSelectedReleaseHistoryEnd({ key: selectedEndRelease.id, text: selectedEndRelease.name });
            // Update context name when both release definition and end release are known
            updateContextName(data?.selectedRelease?.text, selectedEndRelease?.name);
          } else {
            processEndReleaseSelection(data.to, data.from, endReleaseExists, releaseHistoryData);
          }
        } else {
          toast.warn(`Start release with ID ${data.from} not found in release history data`);
          handleStartPointReleaseSelect(defaultSelectedItem, releaseHistoryData);
          setSelectedReleaseHistoryEnd(defaultSelectedItem);
        }
      },
      [handleStartPointReleaseSelect, processEndReleaseSelection, updateContextName]
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

    useEffect(() => {
      if (!dataToRead) return;
      const token = `${dataToRead?.selectedRelease?.key}|${dataToRead?.from}|${dataToRead?.to}`;
      if (restoreTokenRef.current === token) return;
      (async () => {
        await loadSavedData(dataToRead);
        restoreTokenRef.current = token;
        onRestored && onRestored();
      })();
    }, [dataToRead, store.releaseDefinitionList, loadSavedData, onRestored]);

    const UpdateDocumentRequestObject = useCallback(() => {
      addToDocumentRequestObject(
        {
          type: 'change-description-table',
          title: contentControlTitle,
          skin: skin,
          headingLevel: 1,
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
            replaceTaskWithParent,
            workItemFilterOptions,
            compareMode,
          },
        },
        contentControlIndex
      );
    }, [
      addToDocumentRequestObject,
      contentControlTitle,
      skin,
      selectedReleaseDefinition,
      selectedReleaseHistoryStart.key,
      selectedReleaseHistoryEnd.key,
      queriesRequest,
      store.attachmentWikiUrl,
      linkedWiOptions,
      includeCommittedBy,
      includeUnlinkedCommits,
      replaceTaskWithParent,
      contentControlIndex,
      workItemFilterOptions,
      compareMode,
    ]);

    useEffect(() => {
      if (editingMode === false && !isRestoring) {
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
      isRestoring,
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
      } catch {
        /* empty */
      }
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'release');
        } catch {
          /* empty */
        }
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
        <Grid
          container
          spacing={2}
          alignItems='flex-start'
        >
          <Grid size={12}>
            <SmartAutocomplete
              disableClearable
              style={{ marginBlock: 8, width: '100%' }}
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
          </Grid>

          {selectedReleaseDefinition.key !== '' ? (
            <Grid size={{ xs: 12, md: 6 }}>
              <SmartAutocomplete
                disableClearable
                style={{ marginBlock: 8, width: '100%' }}
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
            </Grid>
          ) : null}

          {selectedReleaseDefinition.key !== '' && selectedReleaseHistoryStart !== defaultSelectedItem ? (
            <Grid size={{ xs: 12, md: 6 }}>
              <SmartAutocomplete
                disableClearable
                style={{ marginBlock: 8, width: '100%' }}
                autoHighlight
                openOnFocus
                options={endPointReleaseHistory.map((run) => {
                  return { key: run.id, text: run.name };
                })}
                label='Select end release'
                onChange={async (event, newValue) => {
                  setSelectedReleaseHistoryEnd(newValue);
                  updateContextName(selectedReleaseDefinition.text, newValue.text);
                }}
                value={selectedReleaseHistoryEnd}
              />

            </Grid>
          ) : null}
        </Grid>

        <Grid container spacing={2} alignItems='flex-start' sx={{ mt: 0.5 }}>
          <Grid size={12}>
            <Stack spacing={1.25} sx={{ width: '100%' }}>
              <FormLabel sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Comparison mode
                <Tooltip
                  placement='right'
                  arrow
                  componentsProps={{ tooltip: { sx: { maxWidth: 560 } } }}
                  title={
                    <Box sx={{ fontSize: '0.95rem', lineHeight: 1.6, width: 520 }}>
                      <b>Consecutive (fast):</b> Compares only adjacent releases. Best when artifacts/services exist in most releases.
                      <br />
                      <b>All pairs (slow):</b> Compares every pair. Use for non-adjacent presence; slower and may repeat changes.
                    </Box>
                  }
                >
                  <IconButton size='small' aria-label='Comparison mode help'>
                    <InfoOutlined fontSize='inherit' />
                  </IconButton>
                </Tooltip>
              </FormLabel>
              <RadioGroup row value={compareMode} onChange={(e) => setCompareMode(e.target.value)} name='compare-mode'>
                <FormControlLabel value='consecutive' control={<Radio />} label='Consecutive (fast)' />
                <FormControlLabel value='allPairs' control={<Radio />} label='All pairs (slow)' />
              </RadioGroup>
            </Stack>
          </Grid>
        </Grid>

        {editingMode ? (
          <Button
            variant='contained'
            onClick={() => {
              UpdateDocumentRequestObject();
            }}
          >
            Add Content To Document
          </Button>
        ) : null}
      </div>
    );
  }
);

export default ReleaseSelector;
