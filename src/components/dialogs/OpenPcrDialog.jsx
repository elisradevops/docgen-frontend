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
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import React, { useEffect, useState } from 'react';
import QueryTree from '../common/QueryTree';
import { observer } from 'mobx-react';

const defaultSelectedQueries = {
  openPcrMode: 'none',
  testToOpenPcrQuery: null,
  OpenPcrToTestQuery: null,
  includeCommonColumnsMode: 'both',
};

const OpenPcrDialog = observer(({ store, sharedQueries, prevOpenPcrRequest, onOpenPcrChange }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [openPcrRequest, setOpenPcrRequest] = useState(prevOpenPcrRequest);
  const [queryTrees, setQueryTrees] = useState({
    OpenPcrToTestTree: [],
    TestToOpenPcrTree: [],
  });

  useEffect(() => {
    if (prevOpenPcrRequest) setOpenPcrRequest(prevOpenPcrRequest);
  }, [prevOpenPcrRequest]);

  useEffect(() => {
    const acquiredTrees = sharedQueries.acquiredTrees?.openPcrTestTrees || null;
    acquiredTrees !== null
      ? setQueryTrees(() => ({
          OpenPcrToTestTree: acquiredTrees.OpenPcrToTestTree ? [acquiredTrees.OpenPcrToTestTree] : [],
          TestToOpenPcrTree: acquiredTrees.TestToOpenPcrTree ? [acquiredTrees.TestToOpenPcrTree] : [],
        }))
      : setQueryTrees(defaultSelectedQueries);
  }, [sharedQueries.acquiredTrees]);

  const handleOpenPCRChange = (value) => {
    if (value === 'query') {
      setOpenPcrRequest((prev) => ({ ...prev, openPcrMode: value }));
    } //In case of None or Linked requirement
    else {
      setOpenPcrRequest({ ...defaultSelectedQueries, openPcrMode: value });
    }
  };

  const handleCommonColumnChange = (value) => {
    setOpenPcrRequest((prev) => ({ ...prev, includeCommonColumnsMode: value }));
  };

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const onTestToOpenPCRQuerySelected = (selectedQuery) => {
    setOpenPcrRequest((prev) => ({ ...prev, testToOpenPcrQuery: selectedQuery }));
  };

  const onOpenPcrToTestQuerySelected = (selectedQuery) => {
    setOpenPcrRequest((prev) => ({ ...prev, OpenPcrToTestQuery: selectedQuery }));
  };

  const handleClose = () => {
    // If query mode is selected but no query is chosen, reset to default
    if (openPcrRequest.openPcrMode === 'query' && !openPcrRequest.testToOpenPcrQuery?.value) {
      const resetRequest = { ...defaultSelectedQueries, openPcrMode: 'none' };
      onOpenPcrChange(resetRequest);
    } else {
      onOpenPcrChange(openPcrRequest);
    }
    setOpenDialog(false);
  };

  const openPCRSToggles = (
    <Box>
      <FormLabel id='include-open-pcr-radio'>Based On </FormLabel>
      <RadioGroup
        defaultValue='none'
        row
        name='include-open-pcr-radio'
        value={openPcrRequest.openPcrMode}
        onChange={(event) => {
          handleOpenPCRChange(event.target.value);
        }}
      >
        <FormControlLabel
          value='none'
          label='No Open Pcr'
          control={<Radio />}
        />
        <FormControlLabel
          value='linked'
          label='From Linked CR / Bugs'
          control={<Radio />}
        />
        <FormControlLabel
          value='query'
          label='From Query'
          control={<Radio />}
          disabled={
            !queryTrees.OpenPcrToTestTree ||
            !queryTrees.TestToOpenPcrTree ||
            !(queryTrees.OpenPcrToTestTree.length > 0 || queryTrees.TestToOpenPcrTree.length > 0)
          }
        />
      </RadioGroup>
    </Box>
  );

  const includeSpecialColumnsToggle = (
    <Box>
      <FormLabel id='include-special-columns-radio'>Include Common Columns</FormLabel>
      <RadioGroup
        defaultValue='both'
        row
        name='include-special-columns-radio'
        value={openPcrRequest.includeCommonColumnsMode}
        onChange={(event) => {
          handleCommonColumnChange(event.target.value);
        }}
      >
        <FormControlLabel
          value='both'
          label='Both'
          control={<Radio />}
        />
        <FormControlLabel
          value='openPcrOnly'
          label='Open Pcr Only'
          control={<Radio />}
        />
        <FormControlLabel
          value='testOnly'
          label='Test Case Only'
          control={<Radio />}
        />
      </RadioGroup>
    </Box>
  );

  return (
    <>
      <Button
        variant='outlined'
        color='secondary'
        onClick={handleClickOpen}
        startIcon={<ManageSearchIcon />}
      >
        Open PCR Settings
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
        disablePortal={false}
        sx={{
          '& .MuiDialog-paper': { overflow: 'visible' },
        }}
      >
        <DialogTitle>Open PCR Selection</DialogTitle>
        <DialogContent>
          <Grid
            container
            spacing={2}
            alignContent='center'
            sx={{ justifyContent: 'center' }}
          >
            <Grid size={12}>{openPCRSToggles}</Grid>
            <Grid size={12}>
              <Collapse
                in={openPcrRequest?.openPcrMode === 'query'}
                timeout='auto'
                unmountOnExit
              >
                {includeSpecialColumnsToggle}
                <Box>
                  {queryTrees.TestToOpenPcrTree?.length > 0 && (
                    <>
                      <Typography variant='subtitle1'>Select a Test Case to Open PCR Query</Typography>
                      <div>
                        <QueryTree
                          data={queryTrees.TestToOpenPcrTree}
                          prevSelectedQuery={openPcrRequest.testToOpenPcrQuery}
                          onSelectedQuery={onTestToOpenPCRQuerySelected}
                          queryType='test-OpenPcr'
                          isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                        />
                      </div>
                    </>
                  )}
                  {queryTrees.OpenPcrToTestTree?.length > 0 && (
                    <>
                      <Typography variant='subtitle1'>Select a Open PCR to Test Case Query</Typography>
                      <div>
                        <QueryTree
                          data={queryTrees.OpenPcrToTestTree}
                          prevSelectedQuery={openPcrRequest.OpenPcrToTestQuery}
                          onSelectedQuery={onOpenPcrToTestQuerySelected}
                          queryType='openPcr-test'
                          isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                        />
                      </div>
                    </>
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

export default OpenPcrDialog;
