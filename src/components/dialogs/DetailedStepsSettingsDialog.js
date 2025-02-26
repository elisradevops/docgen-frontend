import {
  Box,
  Checkbox,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Button,
  DialogActions,
} from '@mui/material';
import StairsIcon from '@mui/icons-material/Stairs';
import React, { useState } from 'react';
import QueryTree from '../common/QueryTree';

const DetailedStepsSettingsDialog = ({
  store,
  queryTrees,
  prevStepExecution,
  onStepExecutionStateChange,
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [stepExecutionState, setStepExecutionState] = useState(prevStepExecution);
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
      <div>
        <FormControlLabel
          label='Include Customer Id'
          control={
            <Checkbox
              label='Include Customer Id'
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

      <div>
        <FormLabel
          id='linked-requirement-buttons-group'
          label='Requirement Type'
        >
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
            disabled={queryTrees.testReqTree === null || !queryTrees.testReqTree.length > 0}
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
          <QueryTree
            data={queryTrees.testReqTree}
            prevSelectedQuery={stepExecutionState.generateRequirements.testReqQuery}
            onSelectedQuery={onQuerySelected}
            queryType={'test-req'}
            isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
          />
        </Collapse>
      </div>
    </Box>
  );

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    onStepExecutionStateChange(stepExecutionState);
    setOpenDialog(false);
  };

  return (
    <>
      <Button
        variant='contained'
        color='primary'
        onClick={handleClickOpen}
        startIcon={<StairsIcon />}
      >
        Step Execution Settings
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
        disablePortal={false}
        sx={{
          '& .MuiDialog-paper': { overflow: 'visible' },
        }}
      >
        <DialogTitle>Step Execution Settings</DialogTitle>
        <DialogContent>
          <Grid
            container
            spacing={2}
            alignContent='center'
            sx={{ justifyContent: 'center' }}
          >
            <Grid
              item
              xs={12}
            >
              {detailedStepsExecutionElements}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DetailedStepsSettingsDialog;
