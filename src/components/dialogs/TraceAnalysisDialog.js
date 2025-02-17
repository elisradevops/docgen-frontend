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
import { toJS } from 'mobx';

const defaultSelectedQueries = {
  traceAnalysisMode: 'none',
  reqTestQuery: null,
  testReqQuery: null,
  includeCommonColumnsMode: 'both',
};

const TraceAnalysisDialog = ({ store, sharedQueries, prevTraceAnalysisRequest, onTraceAnalysisChange }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [traceAnalysisRequest, setTraceAnalysisRequest] = useState(prevTraceAnalysisRequest);
  const [queryTrees, setQueryTrees] = useState({
    reqTestTree: [],
    testReqTree: [],
  });

  useEffect(() => {
    const { acquiredTrees } = toJS(sharedQueries);
    acquiredTrees !== null
      ? setQueryTrees(() => ({
          reqTestTree: acquiredTrees.reqTestTree ? [acquiredTrees.reqTestTree] : [],
          testReqTree: acquiredTrees.testReqTree ? [acquiredTrees.testReqTree] : [],
        }))
      : setQueryTrees(defaultSelectedQueries);
  }, [sharedQueries.acquiredTrees]);

  const handleTraceAnalysisChange = (value) => {
    if (value === 'query') {
      setTraceAnalysisRequest((prev) => ({ ...prev, traceAnalysisMode: value }));
    } //In case of None or Linked requirement
    else {
      setTraceAnalysisRequest({ ...defaultSelectedQueries, traceAnalysisMode: value });
    }
  };

  const handleCommonColumnChange = (value) => {
    setTraceAnalysisRequest((prev) => ({ ...prev, includeCommonColumnsMode: value }));
  };

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const onReqTestQuerySelected = (selectedQuery) => {
    setTraceAnalysisRequest((prev) => ({ ...prev, reqTestQuery: selectedQuery }));
  };

  const onTestReqQuerySelected = (selectedQuery) => {
    setTraceAnalysisRequest((prev) => ({ ...prev, testReqQuery: selectedQuery }));
  };

  const handleClose = () => {
    onTraceAnalysisChange(traceAnalysisRequest);
    setOpenDialog(false);
  };

  const traceAnalysisToggles = (
    <Box>
      <FormLabel id='include-trace-analysis-radio'>Based On </FormLabel>
      <RadioGroup
        defaultValue='none'
        row
        name='include-trace-analysis-radio'
        value={traceAnalysisRequest.traceAnalysisMode}
        onChange={(event) => {
          handleTraceAnalysisChange(event.target.value);
        }}
      >
        <FormControlLabel
          value='none'
          label='No Trace'
          control={<Radio />}
        />
        <FormControlLabel
          value='linkedRequirement'
          label='Linked Requirements'
          control={<Radio />}
        />
        <FormControlLabel
          value='query'
          label='Queries'
          control={<Radio />}
          disabled={!(queryTrees.reqTestTree.length > 0 || queryTrees.testReqTree.length > 0)}
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
        value={traceAnalysisRequest.includeCommonColumnsMode}
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
          value='reqOnly'
          label='Requirement Only'
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
        variant='contained'
        color='primary'
        onClick={handleClickOpen}
        startIcon={<ManageSearchIcon />}
      >
        Open Trace Analysis Dialog
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
        disablePortal={false}
        sx={{
          '& .MuiDialog-paper': { overflow: 'visible' },
        }}
      >
        <DialogTitle>Trace Analysis Selection</DialogTitle>
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
              {traceAnalysisToggles}
            </Grid>
            <Grid
              item
              xs={12}
            >
              {includeSpecialColumnsToggle}
            </Grid>
            <Grid
              item
              xs={12}
            >
              <Collapse
                in={traceAnalysisRequest?.traceAnalysisMode === 'query'}
                timeout='auto'
                unmountOnExit
              >
                <Typography variant='subtitle1'>Select a Requirement to Test Case Query</Typography>
                <div>
                  {queryTrees.reqTestTree.length > 0 && (
                    <QueryTree
                      data={queryTrees.reqTestTree}
                      prevSelectedQuery={traceAnalysisRequest.reqTestQuery}
                      onSelectedQuery={onReqTestQuerySelected}
                      queryType='req-test'
                      isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                    />
                  )}
                </div>
                <Typography variant='subtitle1'>Select a Test Case to Requirement Query</Typography>
                <div>
                  {queryTrees.testReqTree.length > 0 && (
                    <QueryTree
                      data={queryTrees.testReqTree}
                      prevSelectedQuery={traceAnalysisRequest.testReqQuery}
                      onSelectedQuery={onTestReqQuerySelected}
                      queryType='test-req'
                      isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                    />
                  )}
                </div>
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
};

export default TraceAnalysisDialog;
