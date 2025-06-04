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
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import LinkIcon from '@mui/icons-material/Link';
import { observer } from 'mobx-react';
const defaultLinkedWiOptions = { isEnabled: false, linkedWiTypes: 'both', linkedWiRelationship: 'both' };
const LinkedWiSelectionDialog = observer(({ prevOptions, setOptions }) => {
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
    <div>
      <FormLabel id='linked-item-type'>Linked Work Item Types to Fetch</FormLabel>
      <RadioGroup
        defaultValue={'none'}
        name='linked-item-type'
        value={prevOptions?.linkedWiTypes}
        onChange={(event) => {
          setOptions((prev) => ({ ...prev, linkedWiTypes: event.target.value }));
        }}
      >
        <FormControlLabel
          value='both'
          label='Both'
          control={<Radio />}
        />
        <FormControlLabel
          value='reqOnly'
          label='Requirement Only'
          control={<Radio />}
        />
        <FormControlLabel
          value='featureOnly'
          label='Feature Only'
          control={<Radio />}
        />
      </RadioGroup>
    </div>
  );

  const linkedWiRelationshipElements = (
    <div>
      <FormLabel id='linked-item-relationship'>Relationship</FormLabel>
      <RadioGroup
        defaultValue={'Affects'}
        name='linked-item-relationship'
        value={options.linkedWiRelationship}
        onChange={(event) => {
          setOptions((prev) => ({ ...prev, linkedWiRelationship: event.target.value }));
        }}
      >
        <FormControlLabel
          value='both'
          label='Both'
          control={<Radio />}
        />
        <FormControlLabel
          value='affectsOnly'
          label='Affects Only'
          control={<Radio />}
        />
        <FormControlLabel
          value='coversOnly'
          label='Covers Only'
          control={<Radio />}
        />
      </RadioGroup>
    </div>
  );

  return (
    <>
      <Button
        variant='contained'
        onClick={handleClickOpen}
        startIcon={<LinkIcon />}
      >
        Linked Work Item Selection
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
      >
        <DialogTitle>Linked Work Item Selection</DialogTitle>
        <DialogContent>
          <Grid
            container
            spacing={2}
            alignItems={'center'}
            sx={{ justifyContent: 'center' }}
          >
            <Grid
              item
              xs={12}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.isEnabled}
                    onChange={(event, checked) => {
                      if (!checked) {
                        setOptions(defaultLinkedWiOptions);
                      } else {
                        setOptions((prev) => ({ ...prev, isEnabled: true }));
                      }
                    }}
                  />
                }
                label='Include Linked WI'
              />
            </Grid>
            <Grid
              item
              xs={12}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  ml: 3,
                  visibility: `${!options.isEnabled ? 'collapse' : 'visible'}`,
                }}
              >
                <Grid
                  container
                  spacing={1}
                  alignContent={'center'}
                  justifyContent={'center'}
                >
                  <Grid
                    item
                    xs={8}
                  >
                    {linkedWiTypesElements}
                  </Grid>
                  <Grid
                    item
                    xs={4}
                  >
                    {linkedWiRelationshipElements}
                  </Grid>
                </Grid>
              </Box>
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
