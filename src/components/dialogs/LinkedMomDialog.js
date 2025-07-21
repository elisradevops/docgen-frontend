import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import QueryTree from '../common/QueryTree';

const defaultSelectedQueries = {
  linkedMomMode: 'none',
  linkedMomQuery: null,
};

const LinkedMomDialog = observer(({ store, sharedQueries, prevLinkedMomRequest, onLinkedMomChange }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [linkedMomRequest, setLinkedMomRequest] = useState(prevLinkedMomRequest);
  const [queryTrees, setQueryTrees] = useState({
    linkedMomTree: [],
  });

  useEffect(() => {
    if (prevLinkedMomRequest) setLinkedMomRequest(prevLinkedMomRequest);
  }, [prevLinkedMomRequest]);

  useEffect(() => {
    if (!sharedQueries.acquiredTrees) return;
    const { linkedMomQueries } = sharedQueries.acquiredTrees;

    linkedMomQueries !== null
      ? setQueryTrees({
          linkedMomTree: linkedMomQueries?.linkedMomTree ? [linkedMomQueries.linkedMomTree] : [],
        })
      : setQueryTrees(defaultSelectedQueries);
  }, [sharedQueries.acquiredTrees]);

  const onLinkedMomQuerySelected = (selectedQuery) => {
    setLinkedMomRequest((prev) => ({ ...prev, linkedMomQuery: selectedQuery }));
  };

  const linkedMomToggles = (
    <Box>
      <FormLabel id='include-linked-mom-radio'>Based On </FormLabel>
      <RadioGroup
        defaultValue='none'
        row
        name='include-linked-mom-radio'
        value={linkedMomRequest.linkedMomMode}
        onChange={(event) => {
          handleLinkedMomChange(event.target.value);
        }}
      >
        <FormControlLabel
          value='none'
          label='None'
          control={<Radio />}
        />
        <FormControlLabel
          value='relation'
          label='By Relation'
          control={<Radio />}
        />
        <FormControlLabel
          value='query'
          label='By Query'
          control={<Radio />}
        />
      </RadioGroup>
    </Box>
  );

  const handleLinkedMomChange = (value) => {
    if (value === 'query') {
      setLinkedMomRequest((prev) => ({ ...prev, linkedMomMode: value }));
    } //In case of None or Linked requirement
    else {
      setLinkedMomRequest({ ...defaultSelectedQueries, linkedMomMode: value });
    }
  };

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    onLinkedMomChange(linkedMomRequest);
    setOpenDialog(false);
  };

  return (
    <>
      <Button
        variant='contained'
        color='primary'
        onClick={handleClickOpen}
      >
        Open Linked MOM Dialog
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
      >
        <DialogTitle>Linked MOM Selection</DialogTitle>
        <DialogContent>
          <Grid
            container
            spacing={2}
            alignItems='center'
            justifyContent='center'
          >
            <Grid
              item
              xs={12}
            >
              {linkedMomToggles}
            </Grid>
            <Grid
              item
              xs={12}
            >
              <Collapse
                in={linkedMomRequest.linkedMomMode === 'query'}
                timeout='auto'
                unmountOnExit
              >
                <Box>
                  <Typography variant='subtitle1'>Select a Query</Typography>
                  {queryTrees.linkedMomTree?.length > 0 && (
                    <QueryTree
                      data={queryTrees.linkedMomTree}
                      prevSelectedQuery={linkedMomRequest.linkedMomQuery}
                      onSelectedQuery={onLinkedMomQuerySelected}
                      queryType='linked-mom'
                      isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                    />
                  )}
                </Box>
              </Collapse>
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

export default LinkedMomDialog;
