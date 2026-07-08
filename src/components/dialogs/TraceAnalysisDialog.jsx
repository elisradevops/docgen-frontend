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
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Switch as AntdSwitch } from 'antd';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import React, { useEffect, useRef, useState } from 'react';
import QueryTree from '../common/QueryTree';
import OverlayLoader from '../common/OverlayLoader';
import { colors } from '../../theme/tokens';
import { observer } from 'mobx-react';

const defaultSelectedQueries = {
  traceAnalysisMode: 'none',
  reqTestQuery: null,
  testReqQuery: null,
  includeCommonColumnsMode: 'both',
  fieldDisplayMapping: {},
  fieldVisibility: {},
  fieldOrder: {},
  sortBy: { 'req-test': 'query', 'test-req': 'query' },
};

const SORT_BY_TOOLTIP =
  'Query: rows follow the order defined by the query itself. Suite: rows follow the suite order used in the generated test description.';
const SORT_BY_DISABLED_TOOLTIP = 'Select a query to enable sorting.';

export const SortByToggle = ({ direction, value, onChange, disabled }) => {
  const isSuite = value === 'suite';
  return (
    <Stack
      direction='row'
      spacing={1}
      alignItems='center'
    >
      <Typography
        variant='body2'
        color={disabled ? 'text.disabled' : 'text.secondary'}
      >
        Sort By
      </Typography>
      <Tooltip title={disabled ? SORT_BY_DISABLED_TOOLTIP : SORT_BY_TOOLTIP}>
        {/* span wrapper: Tooltip needs a non-disabled child to receive hover events */}
        <span>
          <AntdSwitch
            checked={isSuite}
            disabled={disabled}
            checkedChildren='Suite'
            unCheckedChildren='Query'
            onChange={(checked) => onChange(direction, checked ? 'suite' : 'query')}
            style={{ backgroundColor: isSuite ? colors.success : colors.info }}
            aria-label={`Sort by, ${direction}`}
          />
        </span>
      </Tooltip>
    </Stack>
  );
};

const TraceAnalysisDialog = observer(
  ({ store, sharedQueries, prevTraceAnalysisRequest, onTraceAnalysisChange }) => {
    const [openDialog, setOpenDialog] = useState(false);
    const [traceAnalysisRequest, setTraceAnalysisRequest] = useState(prevTraceAnalysisRequest);
    const [queryTrees, setQueryTrees] = useState({
      reqTestTree: [],
      testReqTree: [],
    });

    useEffect(() => {
      if (prevTraceAnalysisRequest) setTraceAnalysisRequest(prevTraceAnalysisRequest);
    }, [prevTraceAnalysisRequest]);

    useEffect(() => {
      if (!sharedQueries.acquiredTrees) return;
      const { reqTestQueries } = sharedQueries.acquiredTrees;
      reqTestQueries !== null
        ? setQueryTrees(() => ({
            reqTestTree: reqTestQueries?.reqTestTree ? [reqTestQueries.reqTestTree] : [],
            testReqTree: reqTestQueries?.testReqTree ? [reqTestQueries.testReqTree] : [],
          }))
        : setQueryTrees({ reqTestTree: [], testReqTree: [] });
    }, [sharedQueries.acquiredTrees]);

    const handleTraceAnalysisChange = (value) => {
      if (value === 'query') {
        setTraceAnalysisRequest((prev) => ({ ...prev, traceAnalysisMode: value }));
      } //In case of None or Linked requirement
      else {
        setTraceAnalysisRequest({ ...defaultSelectedQueries, traceAnalysisMode: value });
      }
    };

    const handleSortByChange = (direction, value) => {
      setTraceAnalysisRequest((prev) => ({
        ...prev,
        sortBy: { ...(prev.sortBy ?? defaultSelectedQueries.sortBy), [direction]: value },
      }));
    };

    const handleClickOpen = () => {
      setOpenDialog(true);
    };

    const reqTestTokenRef = useRef(0);
    const onReqTestQuerySelected = async (selectedQuery) => {
      const token = ++reqTestTokenRef.current;
      let next = selectedQuery;
      if (selectedQuery?.id) {
        const fresh = await store.fetchQueryDefinition({ queryId: selectedQuery.id });
        if (reqTestTokenRef.current !== token) return;
        if (fresh) next = { ...selectedQuery, columns: fresh.columns, ...(fresh.wiql ? { wiql: fresh.wiql } : {}) };
      }
      if (reqTestTokenRef.current !== token) return;
      setTraceAnalysisRequest((prev) => ({ ...prev, reqTestQuery: next }));
    };

    const testReqTokenRef = useRef(0);
    const onTestReqQuerySelected = async (selectedQuery) => {
      const token = ++testReqTokenRef.current;
      let next = selectedQuery;
      if (selectedQuery?.id) {
        const fresh = await store.fetchQueryDefinition({ queryId: selectedQuery.id });
        if (testReqTokenRef.current !== token) return;
        if (fresh) next = { ...selectedQuery, columns: fresh.columns, ...(fresh.wiql ? { wiql: fresh.wiql } : {}) };
      }
      if (testReqTokenRef.current !== token) return;
      setTraceAnalysisRequest((prev) => ({ ...prev, testReqQuery: next }));
    };

    const handleClose = () => {
      // If query mode is selected but no query is chosen, reset to default
      if (traceAnalysisRequest.traceAnalysisMode === 'query' && !traceAnalysisRequest.reqTestQuery?.value && !traceAnalysisRequest.testReqQuery?.value) {
        const resetRequest = { ...defaultSelectedQueries, traceAnalysisMode: 'none' };
        onTraceAnalysisChange(resetRequest);
      } else {
        onTraceAnalysisChange(traceAnalysisRequest);
      }
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
            disabled={
              store.fetchLoadingState().sharedQueriesLoadingState ||
              !queryTrees.reqTestTree ||
              !queryTrees.testReqTree ||
              !(queryTrees.reqTestTree.length > 0 || queryTrees.testReqTree.length > 0)
            }
          />
        </RadioGroup>
      </Box>
    );

    return (
      <>
        <Tooltip title='Open Trace Analysis Dialog'>
          <Button
            variant='outlined'
            color='secondary'
            onClick={handleClickOpen}
            endIcon={<ManageSearchIcon />}
            sx={{
              width: '100%',
              whiteSpace: 'nowrap',
            }}
          >
            Trace Analysis
          </Button>
        </Tooltip>
        <Dialog
          open={openDialog}
          onClose={handleClose}
          disablePortal={false}
          sx={{
            '& .MuiDialog-paper': { overflow: 'visible' },
          }}
        >
          <DialogTitle>Trace Analysis Selection</DialogTitle>
          <DialogContent aria-busy={store.fetchLoadingState().sharedQueriesLoadingState || undefined}>
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
                <Grid size={12}>{traceAnalysisToggles}</Grid>
                <Grid size={12}>
                  <Collapse
                    in={traceAnalysisRequest?.traceAnalysisMode === 'query'}
                    timeout='auto'
                    unmountOnExit
                  >
                    <Box>
                      <Typography variant='subtitle1'>Select a Requirement to Test Case Query</Typography>
                      <Stack
                        direction='row'
                        spacing={2}
                        alignItems='center'
                        flexWrap='wrap'
                        useFlexGap
                      >
                        <QueryTree
                          data={queryTrees.reqTestTree}
                          prevSelectedQuery={traceAnalysisRequest.reqTestQuery}
                          onSelectedQuery={onReqTestQuerySelected}
                          queryType='req-test'
                          isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                        />
                        <SortByToggle
                          direction='req-test'
                          value={traceAnalysisRequest.sortBy?.['req-test'] ?? 'query'}
                          onChange={handleSortByChange}
                          disabled={!traceAnalysisRequest.reqTestQuery}
                        />
                      </Stack>
                      <Typography variant='subtitle1'>Select a Test Case to Requirement Query</Typography>
                      <Stack
                        direction='row'
                        spacing={2}
                        alignItems='center'
                        flexWrap='wrap'
                        useFlexGap
                      >
                        <QueryTree
                          data={queryTrees.testReqTree}
                          prevSelectedQuery={traceAnalysisRequest.testReqQuery}
                          onSelectedQuery={onTestReqQuerySelected}
                          queryType='test-req'
                          isLoading={store.fetchLoadingState().sharedQueriesLoadingState}
                        />
                        <SortByToggle
                          direction='test-req'
                          value={traceAnalysisRequest.sortBy?.['test-req'] ?? 'query'}
                          onChange={handleSortByChange}
                          disabled={!traceAnalysisRequest.testReqQuery}
                        />
                      </Stack>
                    </Box>
                  </Collapse>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>OK</Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
);

export default TraceAnalysisDialog;
