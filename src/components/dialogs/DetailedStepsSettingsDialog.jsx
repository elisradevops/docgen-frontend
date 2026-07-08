import {
  Box,
  Checkbox,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
  Button,
  DialogActions,
  Typography,
} from '@mui/material';
import StairsIcon from '@mui/icons-material/Stairs';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import QueryTree from '../common/QueryTree';
import OverlayLoader from '../common/OverlayLoader';
import FieldDisplayMappingDialog from './FieldDisplayMappingDialog';
import { deriveFieldList } from '../../utils/traceColumnFields';
import { describeColumnDrift, formatColumnDriftMessage, pruneStaleFieldConfig } from '../../utils/columnDrift';

const DetailedStepsSettingsDialog = ({
  store,
  queryTrees,
  prevStepExecution,
  onStepExecutionStateChange,
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [stepExecutionState, setStepExecutionState] = useState(prevStepExecution);
  useEffect(() => {
    if (prevStepExecution) setStepExecutionState(prevStepExecution);
  }, [prevStepExecution]);

  // Fetch per-side valid columns from backend — used both on trace query change and as the
  // semi-live "refresh" the Column Settings dialog triggers on open / via its refresh button.
  // A generation counter ensures a stale in-flight response never overwrites state once a
  // newer request has been issued for a different query selection.
  const [isRefreshingColumns, setIsRefreshingColumns] = useState(false);
  const columnsFetchGenerationRef = useRef(0);

  // Flags that stepExecutionState currently reflects a favorite load, so the next successful
  // column fetch should check for ADO column drift vs. the saved config. store.selectedFavorite
  // is the same signal useTabStatePersistence uses to distinguish a favorite load from a
  // session restore, so this only fires on an actual favorite load.
  const pendingFavoriteColumnCheckRef = useRef(false);
  useEffect(() => {
    if (store.selectedFavorite?.dataToSave) pendingFavoriteColumnCheckRef.current = true;
  }, [store.selectedFavorite]);

  // Reassigned every render so it always closes over the LATEST stepExecutionState. Without
  // this, a useCallback memoized only on [requirementInclusionMode, testReqQuery?.id] would keep
  // using stale fieldOrder/fieldDisplayMapping/fieldVisibility on any refresh triggered without
  // those changing (dialog refresh button, dialog reopen, reselecting the same favorite) —
  // reporting a column as "removed" even after it was re-added in ADO.
  const refreshTraceColumnsImplRef = useRef();
  refreshTraceColumnsImplRef.current = async () => {
    const { requirementInclusionMode, testReqQuery, fieldOrder, fieldVisibility, fieldDisplayMapping } =
      stepExecutionState.generateRequirements || {};
    if (requirementInclusionMode !== 'query' || !testReqQuery) {
      pendingFavoriteColumnCheckRef.current = false;
      return;
    }
    const generation = ++columnsFetchGenerationRef.current;
    setIsRefreshingColumns(true);
    try {
      const result = await store.fetchTraceColumns({ reqTestQuery: undefined, testReqQuery });
      if (generation !== columnsFetchGenerationRef.current) return; // superseded by a newer request

      const fieldsByQuery = deriveFieldList(requirementInclusionMode, null, testReqQuery, result);
      const queries = { 'test-req': testReqQuery };

      // Prune saved rename/hide/order entries for columns no longer in ADO — otherwise a
      // deleted column's stale entry keeps counting as a "pending change" in the trigger badge.
      // Computed before the drift toast so the toast can tell the user whether this fix still
      // needs saving.
      const pruned = pruneStaleFieldConfig(fieldsByQuery, queries, fieldOrder, fieldVisibility, fieldDisplayMapping);

      if (pendingFavoriteColumnCheckRef.current) {
        pendingFavoriteColumnCheckRef.current = false;
        const drift = describeColumnDrift(fieldsByQuery, queries, fieldOrder, fieldDisplayMapping, fieldVisibility);
        const message = formatColumnDriftMessage(drift, 4, pruned.changed);
        if (message) toast.info(message);
      }

      setStepExecutionState((prev) => ({
        ...prev,
        generateRequirements: {
          ...prev.generateRequirements,
          columnMetadata: result,
          fieldOrder: pruned.fieldOrder,
          fieldVisibility: pruned.fieldVisibility,
          fieldDisplayMapping: pruned.fieldDisplayMapping,
        },
      }));
    } catch {
      // best-effort: failure is non-blocking, dialog falls back to merged columns
    } finally {
      if (generation === columnsFetchGenerationRef.current) setIsRefreshingColumns(false);
    }
  };

  // Stable identity (safe to pass as a prop without causing extra effect re-runs) that always
  // delegates to the latest implementation above.
  const refreshTraceColumns = useCallback(() => refreshTraceColumnsImplRef.current(), []);

  useEffect(() => {
    refreshTraceColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepExecutionState.generateRequirements?.requirementInclusionMode, stepExecutionState.generateRequirements?.testReqQuery?.id]);
  const attachmentTypeElements = (attachmentProp) => {
    const getRadioGroup = (name, value, onChange) => (
      <RadioGroup
        row
        name={name}
        value={value ?? 'asEmbedded'} // Default to 'asEmbedded' if value is null or undefined
        onChange={onChange}
      >
        <FormControlLabel
          value='asEmbedded'
          label='As Embedded'
          control={<Radio />}
        />
        <FormControlLabel
          value='asLink'
          label='As Link'
          control={<Radio />}
        />
      </RadioGroup>
    );

    const handleAttachmentTypeChange = (event, setState, key) => {
      const newAttachmentType = event.target.value || 'asEmbedded'; // Fallback to 'asEmbedded' if empty
      setState((prevState) => ({
        ...prevState,
        [key]: {
          ...prevState[key],
          attachmentType: newAttachmentType,
        },
      }));
    };

    const handleRunAttachmentModeUpdate = (event, setState, key) => {
      const newMode = event.target.value || 'both'; // Fallback to 'both' if empty
      setState((prevState) => ({
        ...prevState,
        [key]: {
          ...prevState[key],
          runAttachmentMode: newMode,
        },
      }));
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
        <div>
          <FormLabel id={`include-office-${attachmentProp}-attachment-radio`}>
            Included Office Files Type
          </FormLabel>
          {attachmentProp === 'execution' &&
            getRadioGroup(
              `include-office-execution-attachment-radio`,
              stepExecutionState?.generateAttachments?.attachmentType,
              (event) => handleAttachmentTypeChange(event, setStepExecutionState, 'generateAttachments')
            )}
        </div>
        <Box>
          <FormLabel id='run-attachments-mode-radio'>Evidence By:</FormLabel>
          <RadioGroup
            defaultValue='both'
            row
            name='run-attachments-mode-radio'
            value={stepExecutionState?.generateAttachments?.runAttachmentMode ?? 'both'}
            onChange={(event) => {
              handleRunAttachmentModeUpdate(event, setStepExecutionState, 'generateAttachments');
            }}
          >
            <FormControlLabel
              value='both'
              label='Both'
              control={<Radio />}
            />
            <FormControlLabel
              value='runOnly'
              label='Run Only'
              control={<Radio />}
            />
            <FormControlLabel
              value='planOnly'
              label='Plan Only'
              control={<Radio />}
            />
          </RadioGroup>
        </Box>
        <div>
          <FormControlLabel
            checked={stepExecutionState.generateAttachments.includeAttachmentContent}
            control={<Checkbox />}
            onChange={(event, checked) => {
              setStepExecutionState((prev) => ({
                ...prev,
                generateAttachments: { ...prev.generateAttachments, includeAttachmentContent: checked },
              }));
            }}
            label='Include Attachment Content'
          />
        </div>
      </Box>
    );
  };

  const handleChangeRequirementInclusionMode = (value) => {
    setStepExecutionState((prev) => ({
      ...prev,
      generateRequirements: { ...prev.generateRequirements, requirementInclusionMode: value },
    }));
  };

  const linkedRequirementToggles = (
    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      {stepExecutionState.generateRequirements.requirementInclusionMode !== 'query' && (
        <div>
          <FormControlLabel
            label='Include Customer Id'
            control={
              <Checkbox
                checked={stepExecutionState.generateRequirements.includeCustomerId}
                onChange={(event, checked) => {
                  setStepExecutionState((prev) => ({
                    ...prev,
                    generateRequirements: { ...prev.generateRequirements, includeCustomerId: checked },
                  }));
                }}
              />
            }
          />
        </div>
      )}

      <div>
        <FormLabel id='linked-requirement-buttons-group'>
          Covered Requirements Based On:
        </FormLabel>
        <RadioGroup
          defaultValue={'linkedRequirement'}
          row
          name='linked-requirement-buttons-group'
          value={stepExecutionState.generateRequirements.requirementInclusionMode}
          onChange={(event) => {
            handleChangeRequirementInclusionMode(event.target.value);
          }}
        >
          <FormControlLabel
            value='linkedRequirement'
            label='Linked Requirements'
            control={<Radio />}
          />
          <FormControlLabel
            value='query'
            label='Queries'
            control={<Radio />}
            disabled={
              store.fetchLoadingState().sharedQueriesLoadingState ||
              queryTrees.testReqTree === null ||
              !(queryTrees.testReqTree?.length > 0)
            }
          />
        </RadioGroup>
      </div>

    </Box>
  );

  const onQuerySelected = (selectedQuery) => {
    setStepExecutionState((prev) => ({
      ...prev,
      generateRequirements: { ...prev.generateRequirements, testReqQuery: selectedQuery },
    }));
  };

  const detailedStepsExecutionElements = (
    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      <div>
        <FormControlLabel
          label='Flat Test Cases of a Single Suite'
          control={
            <Checkbox
              checked={stepExecutionState.flatSuiteTestCases}
              onChange={(event, checked) => {
                setStepExecutionState((prev) => ({ ...prev, flatSuiteTestCases: checked }));
              }}
            />
          }
        />
      </div>
      <Divider sx={{ my: 1 }} />
      <div>
        <FormControlLabel
          label='Generate Attachments'
          control={
            <Checkbox
              checked={stepExecutionState.generateAttachments.isEnabled}
              onChange={(event, checked) => {
                setStepExecutionState((prev) => ({
                  ...prev,
                  generateAttachments: { ...prev.generateAttachments, isEnabled: checked },
                }));
              }}
            />
          }
        />
        {stepExecutionState.generateAttachments.isEnabled && attachmentTypeElements('execution')}
      </div>

      <Divider sx={{ my: 1 }} />
      <div>
        <FormControlLabel
          label='Generate Covered Requirements'
          control={
            <Checkbox
              checked={stepExecutionState.generateRequirements.isEnabled}
              onChange={(event, checked) => {
                setStepExecutionState((prev) => ({
                  ...prev,
                  generateRequirements: { ...prev.generateRequirements, isEnabled: checked },
                }));
              }}
            />
          }
        />
        {stepExecutionState.generateRequirements.isEnabled && linkedRequirementToggles}
        <Collapse
          in={
            stepExecutionState.generateRequirements.isEnabled &&
            stepExecutionState.generateRequirements.requirementInclusionMode === 'query' &&
            queryTrees.testReqTree?.length > 0
          }
          timeout='auto'
          unmountOnExit
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <QueryTree
                data={queryTrees.testReqTree}
                prevSelectedQuery={stepExecutionState.generateRequirements.testReqQuery}
                onSelectedQuery={onQuerySelected}
                queryType={'test-req'}
                isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
              />
            </Box>
            <FieldDisplayMappingDialog
              iconOnly
              fieldDisplayMapping={stepExecutionState.generateRequirements.fieldDisplayMapping || {}}
              onMappingChange={(mapping) =>
                setStepExecutionState((prev) => ({
                  ...prev,
                  generateRequirements: { ...prev.generateRequirements, fieldDisplayMapping: mapping },
                }))
              }
              fieldVisibility={stepExecutionState.generateRequirements.fieldVisibility || {}}
              onVisibilityChange={(visibility) =>
                setStepExecutionState((prev) => ({
                  ...prev,
                  generateRequirements: { ...prev.generateRequirements, fieldVisibility: visibility },
                }))
              }
              fieldOrder={stepExecutionState.generateRequirements.fieldOrder || {}}
              onOrderChange={(order) =>
                setStepExecutionState((prev) => ({
                  ...prev,
                  generateRequirements: { ...prev.generateRequirements, fieldOrder: order },
                }))
              }
              traceAnalysisMode={stepExecutionState.generateRequirements.requirementInclusionMode}
              testReqQuery={stepExecutionState.generateRequirements.testReqQuery}
              columnMetadata={stepExecutionState.generateRequirements.columnMetadata}
              onRefreshColumns={refreshTraceColumns}
              isRefreshingColumns={isRefreshingColumns}
            />
          </Box>
        </Collapse>
      </div>
    </Box>
  );

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    // If query mode is selected but no query is chosen, reset to default
    if (
      stepExecutionState.generateRequirements.isEnabled &&
      stepExecutionState.generateRequirements.requirementInclusionMode === 'query' &&
      !stepExecutionState.generateRequirements.testReqQuery?.value
    ) {
      const resetState = {
        ...stepExecutionState,
        generateRequirements: {
          ...stepExecutionState.generateRequirements,
          requirementInclusionMode: 'linkedRequirement',
          testReqQuery: null,
        },
      };
      onStepExecutionStateChange(resetState);
    } else {
      onStepExecutionStateChange(stepExecutionState);
    }
    setOpenDialog(false);
  };

  return (
    <>
      <Button
        variant='outlined'
        color='secondary'
        onClick={handleClickOpen}
        startIcon={<StairsIcon />}
      >
        Step Execution Settings
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
        disablePortal={false}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack direction='row' alignItems='center' spacing={0.5}>
            <Typography variant='h6' component='div'>Step Execution Settings</Typography>
            <Tooltip title='How to use' arrow>
              <IconButton size='small' onClick={(e) => setInfoAnchor(e.currentTarget)} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                <InfoOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Popover
            open={Boolean(infoAnchor)}
            anchorEl={infoAnchor}
            onClose={() => setInfoAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { maxWidth: 340, borderRadius: 2, p: 0 } }}
          >
            <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
              <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>Step Execution Settings Guide</Typography>
            </Box>
            <List dense disablePadding sx={{ px: 1, pb: 1 }}>
              <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                <ListItemText
                  primary='Flat Test Cases of a Single Suite'
                  secondary='Merge test cases from a single suite into one flat table instead of grouped by suite.'
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                <ListItemText
                  primary='Generate Attachments'
                  secondary='Embed step-level and test-level attachments in the document. Choose As Embedded (inline) or As Link (packaged ZIP). Evidence By controls whether run-level, plan-level, or both attachment types are included.'
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                <ListItemText
                  primary='Generate Covered Requirements'
                  secondary='Add a requirements coverage table per test case. Use Linked Requirements for ADO-linked items, or Queries to build the table from a TC → Req query.'
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                <ListItemText
                  primary='Include Customer Id'
                  secondary='Adds the Customer ID column to the requirements table. Available in linked requirements mode only.'
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem sx={{ alignItems: 'flex-start', py: 0.5 }}>
                <ListItemText
                  primary='Column Settings (icon button)'
                  secondary='Appears next to the query selector after a TC → Req query is chosen. Rename, show/hide, or reorder columns in the requirements table.'
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            </List>
          </Popover>
        </DialogTitle>
        <DialogContent
          aria-busy={store.fetchLoadingState().sharedQueriesLoadingState || undefined}
          sx={{ overflow: 'visible' }}
        >
          <Box sx={{ position: 'relative' }}>
            <OverlayLoader
              loading={store.fetchLoadingState().sharedQueriesLoadingState}
              text='Loading queries...'
            />
            <Grid
              container
              spacing={2}
              alignContent='center'
              sx={{ justifyContent: 'center' }}
            >
              <Grid size={12}>{detailedStepsExecutionElements}</Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DetailedStepsSettingsDialog;
