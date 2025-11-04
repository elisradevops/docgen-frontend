import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Tooltip,
  FormControl,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { CiLink } from 'react-icons/ci';
const defaultLinkedWiOptions = { isEnabled: false, linkedWiTypes: 'both', linkedWiRelationship: 'both' };
const LinkedWiSelectionDialog = observer(({ prevOptions, setOptions, buttonLabel = 'Per-change linked work items', buttonVariant = 'outlined', buttonSize = 'small', tooltipTitle = 'Configure per-change linked work items' }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [options, setOptionsState] = useState(prevOptions);
  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  useEffect(() => {
    setOptionsState(prevOptions);
  }, [prevOptions]);

  const handleClose = () => {
    setOpenDialog(false);
  };

  const linkedWiTypesElements = (
    <FormControl component='fieldset' disabled={!options.isEnabled} sx={{ minWidth: 0 }}>
      <FormLabel id='linked-item-type'>Item types</FormLabel>
      <RadioGroup
        name='linked-item-type'
        value={options.linkedWiTypes}
        onChange={(event) => {
          const value = event.target.value;
          setOptionsState((prev) => ({ ...prev, linkedWiTypes: value }));
          setOptions((prev) => ({ ...prev, linkedWiTypes: value }));
        }}
      >
        <FormControlLabel
          value='both'
          label='Both'
          control={<Radio size='small' />}
        />
        <FormControlLabel
          value='reqOnly'
          label='Requirement Only'
          control={<Radio size='small' />}
        />
        <FormControlLabel
          value='featureOnly'
          label='Feature Only'
          control={<Radio size='small' />}
        />
      </RadioGroup>
    </FormControl>
  );

  const linkedWiRelationshipElements = (
    <FormControl component='fieldset' disabled={!options.isEnabled} sx={{ minWidth: 0 }}>
      <FormLabel id='linked-item-relationship'>Relationship</FormLabel>
      <RadioGroup
        name='linked-item-relationship'
        value={options.linkedWiRelationship}
        onChange={(event) => {
          const value = event.target.value;
          setOptionsState((prev) => ({ ...prev, linkedWiRelationship: value }));
          setOptions((prev) => ({ ...prev, linkedWiRelationship: value }));
        }}
      >
        <FormControlLabel
          value='both'
          label='Both'
          control={<Radio size='small' />}
        />
        <FormControlLabel
          value='affectsOnly'
          label='Affects Only'
          control={<Radio size='small' />}
        />
        <FormControlLabel
          value='coversOnly'
          label='Covers Only'
          control={<Radio size='small' />}
        />
      </RadioGroup>
    </FormControl>
  );

  return (
    <>
      <Tooltip title={tooltipTitle} arrow>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          color='secondary'
          onClick={handleClickOpen}
          startIcon={<CiLink />}
        >
          {buttonLabel}
        </Button>
      </Tooltip>
      <Dialog
        open={openDialog}
        onClose={handleClose}
      >
        <DialogTitle>Linked work items (per change)</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} alignItems={'flex-start'}>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.isEnabled}
                    onChange={(event, checked) => {
                      if (!checked) {
                        setOptionsState(defaultLinkedWiOptions);
                        setOptions(defaultLinkedWiOptions);
                      } else {
                        setOptionsState((prev) => ({ ...prev, isEnabled: true }));
                        setOptions((prev) => ({ ...prev, isEnabled: true }));
                      }
                    }}
                  />
                }
                label='Enable per-change linked items'
              />
            </Grid>
            <Grid size={12}>
              <Grid container spacing={2} alignItems={'flex-start'}>
                <Grid size={6}>{linkedWiTypesElements}</Grid>
                <Grid size={6}>{linkedWiRelationshipElements}</Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

export default LinkedWiSelectionDialog;
