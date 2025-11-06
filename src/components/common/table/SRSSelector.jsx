import { Box, Button, Checkbox, FormControlLabel, Collapse, Grid, Typography, Stack, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CategoryIcon from '@mui/icons-material/Category';
import { observer } from 'mobx-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import QueryTree from '../QueryTree';
import { toast } from 'react-toastify';
import SectionCard from '../../layout/SectionCard';
import SettingsDisplay from '../SettingsDisplay';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import RestoreBackdrop from '../RestoreBackdrop';

/**
 * SRSSelector
 * Manages SRS queries and display mode with session/favorite restore via useTabStatePersistence.
 */

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
    const [displayMode, setDisplayMode] = useState('hierarchical');

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

    // Session persistence integration
    const savedDataRef = useRef(null);
    const applySavedData = useCallback(async (dataToSave) => {
      try {
        const saved = dataToSave?.selectedQueries || dataToSave?.queriesRequest || {};
        setQueriesRequest({
          systemRequirements: saved.systemRequirements || null,
          systemToSoftwareRequirements: saved.systemToSoftwareRequirements || null,
          softwareToSystemRequirements: saved.softwareToSystemRequirements || null,
        });
        setIncludeSystemRequirements(!!dataToSave?.includeSystemRequirements);
        setIncludeSystemToSoftwareRequirements(!!dataToSave?.includeSystemToSoftwareRequirements);
        setIncludeSoftwareToSystemRequirements(!!dataToSave?.includeSoftwareToSystemRequirements);
        if (dataToSave?.displayMode) setDisplayMode(dataToSave.displayMode);
        savedDataRef.current = dataToSave;
      } catch {
        toast.error('Error processing saved data');
      }
    }, []);

    const resetLocalState = useCallback(() => {
      setQueriesRequest(defaultSelectedQueriesForSRS);
      setIncludeSystemRequirements(false);
      setIncludeSystemToSoftwareRequirements(false);
      setIncludeSoftwareToSystemRequirements(false);
      setDisplayMode('hierarchical');
      savedDataRef.current = null;
    }, []);

    const { isRestoring, restoreReady } = useTabStatePersistence({
      store,
      contentControlIndex,
      applySavedData,
      resetLocalState,
    });

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

    // Re-apply saved queries when shared queries arrive
    useEffect(() => {
      if (!savedDataRef.current) return;
      if (!sharedQueries?.acquiredTrees) return;
      const dataToSave = savedDataRef.current?.selectedQueries || savedDataRef.current?.queriesRequest;
      if (!dataToSave) return;
      setQueriesRequest({
        systemRequirements: dataToSave.systemRequirements || null,
        systemToSoftwareRequirements: dataToSave.systemToSoftwareRequirements || null,
        softwareToSystemRequirements: dataToSave.softwareToSystemRequirements || null,
      });
    }, [sharedQueries?.acquiredTrees]);

    // Update document request
    const UpdateDocumentRequestObject = useCallback(() => {
      if (!store?.docType) return;
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
            displayMode,
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
      displayMode,
    ]);

    // Save on changes only after restore completes
    useEffect(() => {
      if (!isRestoring && restoreReady) {
        UpdateDocumentRequestObject();
      }
    }, [
      queriesRequest,
      includeSystemRequirements,
      includeSystemToSoftwareRequirements,
      includeSoftwareToSystemRequirements,
      displayMode,
      UpdateDocumentRequestObject,
      isRestoring,
      restoreReady,
    ]);

    // Persist once after restore completes
    useEffect(() => {
      if (!isRestoring && restoreReady) {
        UpdateDocumentRequestObject();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRestoring, restoreReady]);

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
      <>
      <Stack spacing={1.5}>
        <SectionCard
          title='Display Mode'
          description='Choose how to organize requirements in the document.'
          compact
        >
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip 
              title="Displays the full tree structure with all work item types (Features, Epics, and Requirements) showing parent-child relationships"
              placement="top"
              arrow
            >
              <Box
                onClick={() => setDisplayMode('hierarchical')}
                sx={{
                  flex: 1,
                  p: 2,
                  border: '2px solid',
                  borderColor: displayMode === 'hierarchical' ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  backgroundColor: displayMode === 'hierarchical' ? 'primary.main' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: displayMode === 'hierarchical' ? 'primary.main' : 'action.hover',
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <AccountTreeIcon 
                    sx={{ 
                      fontSize: 24,
                      color: displayMode === 'hierarchical' ? 'primary.contrastText' : 'text.secondary',
                    }} 
                  />
                  <Box>
                    <Typography 
                      variant='body2' 
                      fontWeight={displayMode === 'hierarchical' ? 'bold' : 'medium'}
                      color={displayMode === 'hierarchical' ? 'primary.contrastText' : 'text.primary'}
                    >
                      Hierarchical
                    </Typography>
                    <Typography 
                      variant='caption' 
                      sx={{ 
                        color: displayMode === 'hierarchical' ? 'primary.contrastText' : 'text.secondary',
                        opacity: displayMode === 'hierarchical' ? 0.9 : 1,
                      }}
                    >
                      Full tree structure
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Tooltip>

            <Tooltip 
              title="Groups only Requirement work items by their type, filtering out Features and Epics for a focused document"
              placement="top"
              arrow
            >
              <Box
                onClick={() => setDisplayMode('categorized')}
                sx={{
                  flex: 1,
                  p: 2,
                  border: '2px solid',
                  borderColor: displayMode === 'categorized' ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  backgroundColor: displayMode === 'categorized' ? 'primary.main' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: displayMode === 'categorized' ? 'primary.main' : 'action.hover',
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CategoryIcon 
                    sx={{ 
                      fontSize: 24,
                      color: displayMode === 'categorized' ? 'primary.contrastText' : 'text.secondary',
                    }} 
                  />
                  <Box>
                    <Typography 
                      variant='body2' 
                      fontWeight={displayMode === 'categorized' ? 'bold' : 'medium'}
                      color={displayMode === 'categorized' ? 'primary.contrastText' : 'text.primary'}
                    >
                      Categorized
                    </Typography>
                    <Typography 
                      variant='caption' 
                      sx={{ 
                        color: displayMode === 'categorized' ? 'primary.contrastText' : 'text.secondary',
                        opacity: displayMode === 'categorized' ? 0.9 : 1,
                      }}
                    >
                      By requirement type
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Tooltip>
          </Box>
        </SectionCard>

        <SectionCard
          title='System Requirements'
          description='This query seeds the document and is required.'
          enableToggle='Include'
          enabled={includeSystemRequirements}
          onToggle={(_event, checked) => setIncludeSystemRequirements(checked)}
          loading={loading}
          loadingText='Loading queries...'
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
          loading={loading}
          loadingText='Loading queries...'
        >
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1}>
                <FormControlLabel
                  disabled={loading || !queryTrees.systemToSoftwareRequirementsTree?.length}
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
                  disabled={loading || !queryTrees.softwareToSystemRequirementsTree?.length}
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
      <RestoreBackdrop open={!!isRestoring} />
      </>
    );
  }
);

export default SRSSelector;
