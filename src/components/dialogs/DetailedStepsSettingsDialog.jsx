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
import React, { useState, useEffect } from 'react';
import QueryTree from '../common/QueryTree';
import OverlayLoader from '../common/OverlayLoader';
import FieldDisplayMappingDialog from './FieldDisplayMappingDialog';

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

  // Fetch per-side valid columns from backend when the trace query changes (query mode only)
  useEffect(() => {
    const { requirementInclusionMode, testReqQuery } = stepExecutionState.generateRequirements || {};
    if (requirementInclusionMode !== 'query' || !testReqQuery) return;
    let cancelled = false;
    store.fetchTraceColumns({ reqTestQuery: undefined, testReqQuery }).then((result) => {
      if (cancelled) return;
      setStepExecutionState((prev) => ({
        ...prev,
        generateRequirements: { ...prev.generateRequirements, columnMetadata: result },
      }));
    }).catch(() => {
      // best-effort: failure is non-blocking, dialog falls back to merged columns
    });
    return () => { cancelled = true; };
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
