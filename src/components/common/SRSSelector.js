import { Box, Checkbox, FormControlLabel, Collapse } from '@mui/material';
import { observer } from 'mobx-react';
import React, { useState, useEffect, useCallback } from 'react';
import QueryTree from './QueryTree';
import { toast } from 'react-toastify';
import { PrimaryButton } from '@fluentui/react';

const defaultSelectedQueriesForSRS = {
  systemRequirements: null,
  systemToSoftwareRequirements: null,
  softwareToSystemRequirements: null,
};

const SRSSelector = observer(
  ({
    store,
    contentControlTitle,
    type,
    skin,
    addToDocumentRequestObject,
    editingMode,
    contentControlIndex,
    sharedQueries,
  }) => {
    const [queryTrees, setQueryTrees] = useState({
      systemRequirementsTree: [],
      systemToSoftwareRequirementsTree: [],
      softwareToSystemRequirementsTree: [],
    });
    const [queriesRequest, setQueriesRequest] = useState(defaultSelectedQueriesForSRS);
    const [includeSystemRequirements, setIncludeSystemRequirements] = useState(false);
    const [includeSystemToSoftwareRequirements, setIncludeSystemToSoftwareRequirements] = useState(false);
    const [includeSoftwareToSystemRequirements, setIncludeSoftwareToSystemRequirements] = useState(false);

    

    const onSelectedSystemRequirementsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({ ...prev, systemRequirements: query }));
    }, []);

    const onSelectedSystemToSoftwareRequirementsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({ ...prev, systemToSoftwareRequirements: query }));
    }, []);

    const onSelectedSoftwareToSystemRequirementsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({ ...prev, softwareToSystemRequirements: query }));
    }, []);

    const processSystemRequirementsData = useCallback((query) => {
      // Only update the selected query for System Requirements
      setQueriesRequest((prev) => ({ ...prev, systemRequirements: query || null }));
    }, []);

    const processSystemToSoftwareRequirementsData = useCallback((query) => {
      // Only update the selected query for System -> Software Requirements
      setQueriesRequest((prev) => ({ ...prev, systemToSoftwareRequirements: query || null }));
    }, []);

    const processSoftwareToSystemRequirementsData = useCallback((query) => {
      // Only update the selected query for Software -> System Requirements
      setQueriesRequest((prev) => ({ ...prev, softwareToSystemRequirements: query || null }));
    }, []);

    useEffect(() => {
      const acquiredTrees = sharedQueries.acquiredTrees;
      if (acquiredTrees !== null) {
        setQueryTrees(() => ({
          systemRequirementsTree: acquiredTrees.systemRequirementsQueries?.systemRequirementsQueryTree
            ? [acquiredTrees.systemRequirementsQueries.systemRequirementsQueryTree]
            : [],
          systemToSoftwareRequirementsTree: acquiredTrees.systemToSoftwareRequirementsQueries
            ? [acquiredTrees.systemToSoftwareRequirementsQueries]
            : [],
          softwareToSystemRequirementsTree: acquiredTrees.softwareToSystemRequirementsQueries
            ? [acquiredTrees.softwareToSystemRequirementsQueries]
            : [],
        }));
      } else {
        setQueryTrees({
          systemRequirementsTree: [],
          systemToSoftwareRequirementsTree: [],
          softwareToSystemRequirementsTree: [],
        });
      }
    }, [sharedQueries.acquiredTrees]);

    

    //Reading the loaded selected favorite data
    useEffect(() => {
      const selectedFavorite = store.selectedFavorite;
      if (!selectedFavorite?.dataToSave) return;

      const { dataToSave } = selectedFavorite;

      try {
        // Prefer explicitly saved selected queries if present; fallback to backend-filtered queriesRequest
        const savedSelected = dataToSave.selectedQueries || dataToSave.queriesRequest || {};
        // Extract and process saved selected queries (unfiltered) for UI state restoration
        processSystemRequirementsData(savedSelected?.systemRequirements);
        processSystemToSoftwareRequirementsData(savedSelected?.systemToSoftwareRequirements);
        processSoftwareToSystemRequirementsData(savedSelected?.softwareToSystemRequirements);
        // Restore include flags for correct checkbox state
        setIncludeSystemRequirements(dataToSave.includeSystemRequirements || false);
        setIncludeSystemToSoftwareRequirements(dataToSave.includeSystemToSoftwareRequirements || false);
        setIncludeSoftwareToSystemRequirements(dataToSave.includeSoftwareToSystemRequirements || false);
      } catch (error) {
        toast.error('Error processing favorite data:', error);
        setQueriesRequest(defaultSelectedQueriesForSRS);
      }
    }, [store.selectedFavorite]);

    const UpdateDocumentRequestObject = useCallback(() => {
      // Build queriesRequest payload following established pattern (like ChangeDataFactory/TestContentSelector)
      // Only include query objects if the corresponding boolean flag is true AND the query exists
      const backendQueriesRequest = {};

      if (includeSystemRequirements && queriesRequest.systemRequirements) {
        backendQueriesRequest.systemRequirements = queriesRequest.systemRequirements;
      }

      if (includeSystemToSoftwareRequirements && queriesRequest.systemToSoftwareRequirements) {
        backendQueriesRequest.systemToSoftwareRequirements = queriesRequest.systemToSoftwareRequirements;
      }

      if (includeSoftwareToSystemRequirements && queriesRequest.softwareToSystemRequirements) {
        backendQueriesRequest.softwareToSystemRequirements = queriesRequest.softwareToSystemRequirements;
      }

      store.setContextName('');

      addToDocumentRequestObject(
        {
          type: type,
          title: contentControlTitle,
          skin: skin,
          headingLevel: 1, // Default heading level for consistency with other selectors
          data: {
            queriesRequest: backendQueriesRequest,
            // Persist include flags so favorites can restore UI state correctly
            includeSystemRequirements: includeSystemRequirements,
            includeSystemToSoftwareRequirements: includeSystemToSoftwareRequirements,
            includeSoftwareToSystemRequirements: includeSoftwareToSystemRequirements,
            // Persist raw selected queries regardless of include flags to restore UI selections later
            selectedQueries: queriesRequest,
          },
        },
        contentControlIndex
      );
    }, [
      addToDocumentRequestObject,
      contentControlIndex,
      contentControlTitle,
      queriesRequest,
      skin,
      type,
      includeSystemRequirements,
      includeSystemToSoftwareRequirements,
      includeSoftwareToSystemRequirements,
    ]);

    useEffect(() => {
      UpdateDocumentRequestObject();
    }, [
      includeSystemRequirements,
      includeSystemToSoftwareRequirements,
      includeSoftwareToSystemRequirements,
      queriesRequest,
      UpdateDocumentRequestObject,
    ]);

    useEffect(() => {
      let isValid = true;
      let message = '';
      const chosen = [];
      if (includeSystemRequirements && queriesRequest.systemRequirements) chosen.push('system');
      if (includeSystemToSoftwareRequirements && queriesRequest.systemToSoftwareRequirements) chosen.push('sys->sw');
      if (includeSoftwareToSystemRequirements && queriesRequest.softwareToSystemRequirements) chosen.push('sw->sys');
      if (chosen.length === 0) {
        isValid = false;
        message = 'Select at least one query to include';
      }
      try {
        store.setValidationState(contentControlIndex, 'srs', { isValid, message });
        store.clearValidationForIndex(contentControlIndex, 'init');
      } catch {}
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'srs');
        } catch {}
      };
    }, [
      includeSystemRequirements,
      includeSystemToSoftwareRequirements,
      includeSoftwareToSystemRequirements,
      queriesRequest?.systemRequirements,
      queriesRequest?.systemToSoftwareRequirements,
      queriesRequest?.softwareToSystemRequirements,
      store,
      contentControlIndex,
    ]);

    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            disabled={!queryTrees.systemRequirementsTree || queryTrees.systemRequirementsTree?.length === 0}
            control={
              <Checkbox
                checked={includeSystemRequirements}
                onChange={(event, checked) => {
                  setIncludeSystemRequirements(checked);
                  if (checked === false) {
                    setQueriesRequest((prev) => ({ ...prev, systemRequirements: null }));
                  }
                }}
              />
            }
            label='Include System Requirements'
          />
          <Collapse
            in={includeSystemRequirements}
            timeout='auto'
            unmountOnExit
          >
            {queryTrees.systemRequirementsTree?.length > 0 && (
              <QueryTree
                data={queryTrees.systemRequirementsTree}
                prevSelectedQuery={queriesRequest.systemRequirements}
                onSelectedQuery={onSelectedSystemRequirementsQuery}
                queryType={'system-requirements'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            )}
          </Collapse>

          <FormControlLabel
            disabled={
              !queryTrees.systemToSoftwareRequirementsTree ||
              queryTrees.systemToSoftwareRequirementsTree?.length === 0
            }
            control={
              <Checkbox
                checked={includeSystemToSoftwareRequirements}
                onChange={(event, checked) => {
                  setIncludeSystemToSoftwareRequirements(checked);
                  if (checked === false) {
                    setQueriesRequest((prev) => ({ ...prev, systemToSoftwareRequirements: null }));
                  }
                }}
              />
            }
            label='Include System to Software Requirements'
          />

          <Collapse
            in={includeSystemToSoftwareRequirements}
            timeout='auto'
            unmountOnExit
          >
            {queryTrees.systemToSoftwareRequirementsTree?.length > 0 && (
              <QueryTree
                data={queryTrees.systemToSoftwareRequirementsTree}
                prevSelectedQuery={queriesRequest.systemToSoftwareRequirements}
                onSelectedQuery={onSelectedSystemToSoftwareRequirementsQuery}
                queryType={'system-to-software'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            )}
          </Collapse>

          <FormControlLabel
            disabled={
              !queryTrees.softwareToSystemRequirementsTree ||
              queryTrees.softwareToSystemRequirementsTree?.length === 0
            }
            control={
              <Checkbox
                checked={includeSoftwareToSystemRequirements}
                onChange={(event, checked) => {
                  setIncludeSoftwareToSystemRequirements(checked);
                  if (checked === false) {
                    setQueriesRequest((prev) => ({ ...prev, softwareToSystemRequirements: null }));
                  }
                }}
              />
            }
            label='Include Software to System Requirements'
          />

          <Collapse
            in={includeSoftwareToSystemRequirements}
            timeout='auto'
            unmountOnExit
          >
            {queryTrees.softwareToSystemRequirementsTree?.length > 0 && (
              <QueryTree
                data={queryTrees.softwareToSystemRequirementsTree}
                prevSelectedQuery={queriesRequest.softwareToSystemRequirements}
                onSelectedQuery={onSelectedSoftwareToSystemRequirementsQuery}
                queryType={'software-to-system'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            )}
          </Collapse>
        </Box>

        <br />
        <br />
        {/* Add Content To Document button - works only in document managing mode */}
        {editingMode ? (
          <PrimaryButton
            text='Add Content To Document'
            onClick={() => {
              UpdateDocumentRequestObject();
            }}
          />
        ) : null}
      </>
    );
  }
);

export default SRSSelector;
