import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Collapse,
  Grid,
  Typography,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
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
 * RequirementsSelector
 * Manages requirements queries with session/favorite restore via useTabStatePersistence.
 * Used by both SRS and SysRS document variants.
 */

const defaultQueriesForSRS = {
  systemRequirements: null,
  systemToSoftwareRequirements: null,
  softwareToSystemRequirements: null,
};

const defaultQueriesForSysRS = {
  systemRequirements: null,
  subsystemToSystemRequirements: null,
  systemToSubsystemRequirements: null,
};

const RequirementsSelector = observer(
  ({
    store,
    contentControlTitle,
    type,
    skin,
    addToDocumentRequestObject,
    editingMode,
    contentControlIndex,
    sharedQueries,
    variant = 'srs',
  }) => {
    const isSysRs = String(variant || '').toLowerCase() === 'sysrs';
    const requirementsLabel = isSysRs ? 'System Requirements' : 'Software Requirements';
    const firstTraceLabel = isSysRs ? 'Sub-System → System traceability' : 'System → Software requirements';
    const secondTraceLabel = isSysRs ? 'System → Sub-System traceability' : 'Software → System requirements';
    const validationKey = isSysRs ? 'sysrs' : 'srs';

    const [queryTrees, setQueryTrees] = useState({
      systemRequirementsTree: [],
      forwardTraceTree: [],
      reverseTraceTree: [],
    });
    const defaultQueries = isSysRs ? defaultQueriesForSysRS : defaultQueriesForSRS;
    const [queriesRequest, setQueriesRequest] = useState(defaultQueries);
    const [displayMode, setDisplayMode] = useState('hierarchical');

    // Indicator checkboxes (first is always required if queries exist)
    const [includeSystemRequirements, setIncludeSystemRequirements] = useState(false);
    const [includeSystemToSoftwareRequirements, setIncludeSystemToSoftwareRequirements] = useState(false);
    const [includeSoftwareToSystemRequirements, setIncludeSoftwareToSystemRequirements] = useState(false);

    // Session persistence integration
    const savedDataRef = useRef(null);
    const applySavedData = useCallback(
      async (dataToSave) => {
        try {
          const saved = dataToSave?.selectedQueries || dataToSave?.queriesRequest || {};
          setQueriesRequest(
            isSysRs
              ? {
                  systemRequirements: saved.systemRequirements || null,
                  subsystemToSystemRequirements: saved.subsystemToSystemRequirements || null,
                  systemToSubsystemRequirements: saved.systemToSubsystemRequirements || null,
                }
              : {
                  systemRequirements: saved.systemRequirements || null,
                  systemToSoftwareRequirements: saved.systemToSoftwareRequirements || null,
                  softwareToSystemRequirements: saved.softwareToSystemRequirements || null,
                },
          );
          setIncludeSystemRequirements(!!dataToSave?.includeSystemRequirements);
          setIncludeSystemToSoftwareRequirements(!!dataToSave?.includeSystemToSoftwareRequirements);
          setIncludeSoftwareToSystemRequirements(!!dataToSave?.includeSoftwareToSystemRequirements);
          if (!isSysRs && dataToSave?.displayMode) setDisplayMode(dataToSave.displayMode);
          savedDataRef.current = dataToSave;
        } catch {
          toast.error('Error processing saved data');
        }
      },
      [isSysRs],
    );

    const resetLocalState = useCallback(() => {
      setQueriesRequest(isSysRs ? defaultQueriesForSysRS : defaultQueriesForSRS);
      setIncludeSystemRequirements(false);
      setIncludeSystemToSoftwareRequirements(false);
      setIncludeSoftwareToSystemRequirements(false);
      setDisplayMode('hierarchical');
      savedDataRef.current = null;
    }, [isSysRs]);

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
    const onSelectedForwardTraceQuery = useCallback(
      (query) => {
        setQueriesRequest((prev) =>
          isSysRs
            ? {
                ...prev,
                subsystemToSystemRequirements: query,
              }
            : {
                ...prev,
                systemToSoftwareRequirements: query,
              },
        );
      },
      [isSysRs],
    );
    const onSelectedReverseTraceQuery = useCallback(
      (query) => {
        setQueriesRequest((prev) =>
          isSysRs
            ? {
                ...prev,
                systemToSubsystemRequirements: query,
              }
            : {
                ...prev,
                softwareToSystemRequirements: query,
              },
        );
      },
      [isSysRs],
    );

    // Acquire trees
    useEffect(() => {
      const acquired = sharedQueries?.acquiredTrees;
      if (acquired) {
        setQueryTrees({
          systemRequirementsTree: acquired.systemRequirementsQueries?.systemRequirementsQueryTree
            ? [acquired.systemRequirementsQueries.systemRequirementsQueryTree]
            : [],
          forwardTraceTree: isSysRs
            ? acquired.subsystemToSystemRequirementsQueries
              ? [acquired.subsystemToSystemRequirementsQueries]
              : []
            : acquired.systemToSoftwareRequirementsQueries
              ? [acquired.systemToSoftwareRequirementsQueries]
              : [],
          reverseTraceTree: isSysRs
            ? acquired.systemToSubsystemRequirementsQueries
              ? [acquired.systemToSubsystemRequirementsQueries]
              : []
            : acquired.softwareToSystemRequirementsQueries
              ? [acquired.softwareToSystemRequirementsQueries]
              : [],
        });
      } else {
        setQueryTrees({
          systemRequirementsTree: [],
          forwardTraceTree: [],
          reverseTraceTree: [],
        });
      }
    }, [sharedQueries?.acquiredTrees, isSysRs]);

    // Re-apply saved queries when shared queries arrive
    useEffect(() => {
      if (!savedDataRef.current) return;
      if (!sharedQueries?.acquiredTrees) return;
      const dataToSave = savedDataRef.current?.selectedQueries || savedDataRef.current?.queriesRequest;
      if (!dataToSave) return;
      setQueriesRequest(
        isSysRs
          ? {
              systemRequirements: dataToSave.systemRequirements || null,
              subsystemToSystemRequirements: dataToSave.subsystemToSystemRequirements || null,
              systemToSubsystemRequirements: dataToSave.systemToSubsystemRequirements || null,
            }
          : {
              systemRequirements: dataToSave.systemRequirements || null,
              systemToSoftwareRequirements: dataToSave.systemToSoftwareRequirements || null,
              softwareToSystemRequirements: dataToSave.softwareToSystemRequirements || null,
            },
      );
    }, [sharedQueries?.acquiredTrees, isSysRs]);

    // Update document request
    const UpdateDocumentRequestObject = useCallback(() => {
      if (!store?.docType) return;
      const backend = {};
      const selectedForwardTrace = isSysRs
        ? queriesRequest.subsystemToSystemRequirements
        : queriesRequest.systemToSoftwareRequirements;
      const selectedReverseTrace = isSysRs
        ? queriesRequest.systemToSubsystemRequirements
        : queriesRequest.softwareToSystemRequirements;

      if (queriesRequest.systemRequirements) {
        backend.systemRequirements = queriesRequest.systemRequirements;
      }
      if (includeSystemToSoftwareRequirements && selectedForwardTrace) {
        if (isSysRs) {
          backend.subsystemToSystemRequirements = selectedForwardTrace;
        } else {
          backend.systemToSoftwareRequirements = selectedForwardTrace;
        }
      }
      if (includeSoftwareToSystemRequirements && selectedReverseTrace) {
        if (isSysRs) {
          backend.systemToSubsystemRequirements = selectedReverseTrace;
        } else {
          backend.softwareToSystemRequirements = selectedReverseTrace;
        }
      }

      store.setContextName('');

      const data = {
        queriesRequest: backend,
        includeSystemRequirements,
        includeSystemToSoftwareRequirements,
        includeSoftwareToSystemRequirements,
      };

      if (!isSysRs) {
        data.displayMode = displayMode;
      }

      addToDocumentRequestObject(
        {
          type,
          title: contentControlTitle,
          skin,
          headingLevel: 1,
          data,
        },
        contentControlIndex,
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
      isSysRs,
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

    // Validation: requirements base query is required
    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!queriesRequest.systemRequirements) {
        isValid = false;
        message = `${requirementsLabel} query is required`;
      }

      store.setValidationState(contentControlIndex, validationKey, {
        isValid,
        message,
      });
      store.clearValidationForIndex(contentControlIndex, 'init');

      return () => {
        store.clearValidationForIndex(contentControlIndex, validationKey);
      };
    }, [queriesRequest.systemRequirements, store, contentControlIndex, requirementsLabel, validationKey]);

    const loading = store.fetchLoadingState().sharedQueriesLoadingState;
    const selectedForwardTrace = isSysRs
      ? queriesRequest.subsystemToSystemRequirements
      : queriesRequest.systemToSoftwareRequirements;
    const selectedReverseTrace = isSysRs
      ? queriesRequest.systemToSubsystemRequirements
      : queriesRequest.softwareToSystemRequirements;

    const systemRequirementSummary =
      includeSystemRequirements && queriesRequest.systemRequirements
        ? [
            `Query: ${queriesRequest.systemRequirements.value || queriesRequest.systemRequirements.text || queriesRequest.systemRequirements.title || 'Custom'}`,
          ]
        : undefined;
    const systemToSoftwareSummary =
      includeSystemToSoftwareRequirements && selectedForwardTrace
        ? [
            `Query: ${
              selectedForwardTrace.value ||
              selectedForwardTrace.text ||
              selectedForwardTrace.title ||
              'Custom'
            }`,
          ]
        : undefined;
    const softwareToSystemSummary =
      includeSoftwareToSystemRequirements && selectedReverseTrace
        ? [
            `Query: ${
              selectedReverseTrace.value ||
              selectedReverseTrace.text ||
              selectedReverseTrace.title ||
              'Custom'
            }`,
          ]
        : undefined;

    return (
      <>
        <Stack spacing={1.5}>
          {!isSysRs ? (
            <SectionCard
              title='Display Mode'
              description='Choose how to organize requirements in the document.'
              compact
            >
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Tooltip
                  title='Displays the full tree structure with all work item types (Features, Epics, and Requirements) showing parent-child relationships'
                  placement='top'
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
                    <Stack
                      direction='row'
                      spacing={1.5}
                      alignItems='center'
                    >
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
                  title='Groups only Requirement work items by their type, filtering out Features and Epics for a focused document'
                  placement='top'
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
                    <Stack
                      direction='row'
                      spacing={1.5}
                      alignItems='center'
                    >
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
          ) : null}

          <SectionCard
            title={requirementsLabel}
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
                  queryType={isSysRs ? 'system-requirements' : 'software-requirements'}
                  isLoading={loading}
                />
              </Stack>
            ) : (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {`Enable ${requirementsLabel.toLowerCase()} to select the base requirement set.`}
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
            {isSysRs && (includeSystemToSoftwareRequirements || includeSoftwareToSystemRequirements) ? (
              <Alert
                severity='info'
                sx={{ mb: 1.5 }}
              >
                If this document is a system-level specification - no traceability is required. For a
                sub-system specification - the following trace tables are required.
              </Alert>
            ) : null}
            <Grid
              container
              spacing={1.5}
            >
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={1}>
                  <FormControlLabel
                    disabled={loading || !queryTrees.forwardTraceTree?.length}
                    control={
                      <Checkbox
                        checked={includeSystemToSoftwareRequirements}
                        onChange={(_event, checked) => setIncludeSystemToSoftwareRequirements(checked)}
                      />
                    }
                    label={firstTraceLabel}
                  />
                  <Collapse
                    in={includeSystemToSoftwareRequirements}
                    timeout='auto'
                    unmountOnExit
                  >
                    <Stack spacing={1}>
                      <SettingsDisplay
                        title='Selected query'
                        settings={systemToSoftwareSummary || []}
                        emptyMessage='No query selected yet.'
                        boxProps={{ p: 0, bgcolor: 'transparent' }}
                      />
                      <QueryTree
                        data={queryTrees.forwardTraceTree}
                        prevSelectedQuery={selectedForwardTrace}
                        onSelectedQuery={onSelectedForwardTraceQuery}
                        queryType={isSysRs ? 'subsystem-to-system' : 'system-to-software'}
                        isLoading={loading}
                      />
                    </Stack>
                  </Collapse>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={1}>
                  <FormControlLabel
                    disabled={loading || !queryTrees.reverseTraceTree?.length}
                    control={
                      <Checkbox
                        checked={includeSoftwareToSystemRequirements}
                        onChange={(_event, checked) => setIncludeSoftwareToSystemRequirements(checked)}
                      />
                    }
                    label={secondTraceLabel}
                  />
                  <Collapse
                    in={includeSoftwareToSystemRequirements}
                    timeout='auto'
                    unmountOnExit
                  >
                    <Stack spacing={1}>
                      <SettingsDisplay
                        title='Selected query'
                        settings={softwareToSystemSummary || []}
                        emptyMessage='No query selected yet.'
                        boxProps={{ p: 0, bgcolor: 'transparent' }}
                      />
                      <QueryTree
                        data={queryTrees.reverseTraceTree}
                        prevSelectedQuery={selectedReverseTrace}
                        onSelectedQuery={onSelectedReverseTraceQuery}
                        queryType={isSysRs ? 'system-to-subsystem' : 'software-to-system'}
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
              <Button
                variant='contained'
                onClick={UpdateDocumentRequestObject}
              >
                Add Content To Document
              </Button>
            </Box>
          ) : null}
        </Stack>
        <RestoreBackdrop
          open={!!isRestoring}
          label={`Restoring ${isSysRs ? 'SysRS' : 'SRS'} selection…`}
        />
      </>
    );
  },
);

export default RequirementsSelector;
