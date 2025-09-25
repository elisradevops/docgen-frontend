import { Box, Button, Checkbox, FormControlLabel, Collapse, Grid, Typography, Stack } from '@mui/material';
import { observer } from 'mobx-react';
import React, { useState, useEffect, useCallback } from 'react';
import QueryTree from '../QueryTree';
import { toast } from 'react-toastify';
import SectionCard from '../../layout/SectionCard';
import SettingsDisplay from '../SettingsDisplay';

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
    const [queriesRequest, setQueriesRequest] = useState(
      defaultSelectedQueriesForSRS
    );

    // Indicator checkboxes (first is always required if queries exist)
    const [includeSystemRequirements, setIncludeSystemRequirements] =
      useState(false);
    const [
      includeSystemToSoftwareRequirements,
      setIncludeSystemToSoftwareRequirements,
    ] = useState(false);
    const [
      includeSoftwareToSystemRequirements,
      setIncludeSoftwareToSystemRequirements,
    ] = useState(false);

    // Handlers for selections
    const onSelectedSystemRequirementsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({ ...prev, systemRequirements: query }));
    }, []);
    const onSelectedSystemToSoftwareRequirementsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({
        ...prev,
        systemToSoftwareRequirements: query,
      }));
    }, []);
    const onSelectedSoftwareToSystemRequirementsQuery = useCallback((query) => {
      setQueriesRequest((prev) => ({
        ...prev,
        softwareToSystemRequirements: query,
      }));
    }, []);

    // Acquire trees
    useEffect(() => {
      const acquired = sharedQueries?.acquiredTrees;
      if (acquired) {
        setQueryTrees({
          systemRequirementsTree: acquired.systemRequirementsQueries
            ?.systemRequirementsQueryTree
            ? [acquired.systemRequirementsQueries.systemRequirementsQueryTree]
            : [],
          systemToSoftwareRequirementsTree:
            acquired.systemToSoftwareRequirementsQueries
              ? [acquired.systemToSoftwareRequirementsQueries]
              : [],
          softwareToSystemRequirementsTree:
            acquired.softwareToSystemRequirementsQueries
              ? [acquired.softwareToSystemRequirementsQueries]
              : [],
        });
      } else {
        setQueryTrees({
          systemRequirementsTree: [],
          systemToSoftwareRequirementsTree: [],
          softwareToSystemRequirementsTree: [],
        });
      }
    }, [sharedQueries?.acquiredTrees]);

    // Restore saved favorite
    useEffect(() => {
      const favorite = store.selectedFavorite;
      if (!favorite?.dataToSave) return;

      try {
        const { dataToSave } = favorite;
        const saved =
          dataToSave.selectedQueries || dataToSave.queriesRequest || {};

        setQueriesRequest({
          systemRequirements: saved.systemRequirements || null,
          systemToSoftwareRequirements:
            saved.systemToSoftwareRequirements || null,
          softwareToSystemRequirements:
            saved.softwareToSystemRequirements || null,
        });

        // restore include flags (systemRequirements still enforced by validation)
        setIncludeSystemRequirements(!!dataToSave.includeSystemRequirements);
        setIncludeSystemToSoftwareRequirements(
          !!dataToSave.includeSystemToSoftwareRequirements
        );
        setIncludeSoftwareToSystemRequirements(
          !!dataToSave.includeSoftwareToSystemRequirements
        );
      } catch {
        toast.error('Error processing favorite data');
        setQueriesRequest(defaultSelectedQueriesForSRS);
      }
    }, [store.selectedFavorite]);

    // Update document request
    const UpdateDocumentRequestObject = useCallback(() => {
      const backend = {};

      if (queriesRequest.systemRequirements) {
        backend.systemRequirements = queriesRequest.systemRequirements;
      }
      if (
        includeSystemToSoftwareRequirements &&
        queriesRequest.systemToSoftwareRequirements
      ) {
        backend.systemToSoftwareRequirements =
          queriesRequest.systemToSoftwareRequirements;
      }
      if (
        includeSoftwareToSystemRequirements &&
        queriesRequest.softwareToSystemRequirements
      ) {
        backend.softwareToSystemRequirements =
          queriesRequest.softwareToSystemRequirements;
      }

      store.setContextName('');

      addToDocumentRequestObject(
        {
          type,
          title: contentControlTitle,
          skin,
          headingLevel: 1,
          data: {
            queriesRequest: backend,
            includeSystemRequirements,
            includeSystemToSoftwareRequirements,
            includeSoftwareToSystemRequirements,
            selectedQueries: queriesRequest,
          },
        },
        contentControlIndex
      );
    }, [
      queriesRequest,
      includeSystemRequirements,
      includeSystemToSoftwareRequirements,
      includeSoftwareToSystemRequirements,
      store,
      addToDocumentRequestObject,
      type,
      contentControlTitle,
      skin,
      contentControlIndex,
    ]);

    useEffect(() => {
      UpdateDocumentRequestObject();
    }, [
      queriesRequest,
      includeSystemRequirements,
      includeSystemToSoftwareRequirements,
      includeSoftwareToSystemRequirements,
      UpdateDocumentRequestObject,
    ]);

    // Validation: System Requirements is required
    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!queriesRequest.systemRequirements) {
        isValid = false;
        message = 'System Requirements query is required';
      }

      store.setValidationState(contentControlIndex, 'srs', {
        isValid,
        message,
      });
      store.clearValidationForIndex(contentControlIndex, 'init');

      return () => {
        store.clearValidationForIndex(contentControlIndex, 'srs');
      };
    }, [queriesRequest.systemRequirements, store, contentControlIndex]);

    const loading = store.fetchLoadingState().sharedQueriesLoadingState;

    const systemRequirementSummary = includeSystemRequirements && queriesRequest.systemRequirements
      ? [`Query: ${queriesRequest.systemRequirements.value || queriesRequest.systemRequirements.text || queriesRequest.systemRequirements.title || 'Custom'}`]
      : undefined;
    const systemToSoftwareSummary = includeSystemToSoftwareRequirements && queriesRequest.systemToSoftwareRequirements
      ? [`Query: ${
          queriesRequest.systemToSoftwareRequirements.value ||
          queriesRequest.systemToSoftwareRequirements.text ||
          queriesRequest.systemToSoftwareRequirements.title ||
          'Custom'
        }`]
      : undefined;
    const softwareToSystemSummary = includeSoftwareToSystemRequirements && queriesRequest.softwareToSystemRequirements
      ? [`Query: ${
          queriesRequest.softwareToSystemRequirements.value ||
          queriesRequest.softwareToSystemRequirements.text ||
          queriesRequest.softwareToSystemRequirements.title ||
          'Custom'
        }`]
      : undefined;

    return (
      <Stack spacing={1.5}>
        <SectionCard
          title='System Requirements'
          description='This query seeds the document and is required.'
          enableToggle='Include'
          enabled={includeSystemRequirements}
          onToggle={(_event, checked) => setIncludeSystemRequirements(checked)}
        >
          {includeSystemRequirements ? (
            <Stack spacing={1}>
              <SettingsDisplay
                title='Selected query'
                settings={systemRequirementSummary || []}
                emptyMessage='No query selected yet.'
                boxProps={{ p: 0, bgcolor: 'transparent' }}
              />
              <QueryTree
                data={queryTrees.systemRequirementsTree}
                prevSelectedQuery={queriesRequest.systemRequirements}
                onSelectedQuery={onSelectedSystemRequirementsQuery}
                queryType='system-requirements'
                isLoading={loading}
              />
            </Stack>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              Enable system requirements to select the base requirement set.
            </Typography>
          )}
        </SectionCard>

        <SectionCard
          title='Trace analysis'
          description='Optionally include cross-level requirement mappings.'
          compact
        >
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1}>
                <FormControlLabel
                  disabled={!queryTrees.systemToSoftwareRequirementsTree?.length}
                  control={
                    <Checkbox
                      checked={includeSystemToSoftwareRequirements}
                      onChange={(_event, checked) => setIncludeSystemToSoftwareRequirements(checked)}
                    />
                  }
                  label='System → Software requirements'
                />
                <Collapse in={includeSystemToSoftwareRequirements} timeout='auto' unmountOnExit>
                  <Stack spacing={1}>
                    <SettingsDisplay
                      title='Selected query'
                      settings={systemToSoftwareSummary || []}
                      emptyMessage='No query selected yet.'
                      boxProps={{ p: 0, bgcolor: 'transparent' }}
                    />
                    <QueryTree
                      data={queryTrees.systemToSoftwareRequirementsTree}
                      prevSelectedQuery={queriesRequest.systemToSoftwareRequirements}
                      onSelectedQuery={onSelectedSystemToSoftwareRequirementsQuery}
                      queryType='system-to-software'
                      isLoading={loading}
                    />
                  </Stack>
                </Collapse>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1}>
                <FormControlLabel
                  disabled={!queryTrees.softwareToSystemRequirementsTree?.length}
                  control={
                    <Checkbox
                      checked={includeSoftwareToSystemRequirements}
                      onChange={(_event, checked) => setIncludeSoftwareToSystemRequirements(checked)}
                    />
                  }
                  label='Software → System requirements'
                />
                <Collapse in={includeSoftwareToSystemRequirements} timeout='auto' unmountOnExit>
                  <Stack spacing={1}>
                    <SettingsDisplay
                      title='Selected query'
                      settings={softwareToSystemSummary || []}
                      emptyMessage='No query selected yet.'
                      boxProps={{ p: 0, bgcolor: 'transparent' }}
                    />
                    <QueryTree
                      data={queryTrees.softwareToSystemRequirementsTree}
                      prevSelectedQuery={queriesRequest.softwareToSystemRequirements}
                      onSelectedQuery={onSelectedSoftwareToSystemRequirementsQuery}
                      queryType='software-to-system'
                      isLoading={loading}
                    />
                  </Stack>
                </Collapse>
              </Stack>
            </Grid>
          </Grid>
        </SectionCard>

        {editingMode ? (
          <Box>
            <Button variant='contained' onClick={UpdateDocumentRequestObject}>
              Add Content To Document
            </Button>
          </Box>
        ) : null}
      </Stack>
    );
  }
);

export default SRSSelector;
