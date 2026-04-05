import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import QueryTree from '../../common/QueryTree';
import { toast } from 'react-toastify';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import RestoreBackdrop from '../../common/RestoreBackdrop';
import {
  formatDateTime,
  isHistoricalCompareResultCurrent,
  validateHistoricalCompareInputs,
  toIsoOrEmpty,
  toLocalDateTimeInputValue,
} from './historicalQueryUtils';
import {
  buildHistoricalQueryTree,
  getWorkItemIconUrl,
  isSameOrigin,
  normalizeWorkItemColor,
} from '../../../utils/historicalQuery';

const MODE_AS_OF = 'asof';
const MODE_COMPARE = 'compare';

const findTreeNode = (nodes, predicate) => {
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (predicate(node)) return node;
    if (Array.isArray(node?.children) && node.children.length > 0) {
      const found = findTreeNode(node.children, predicate);
      if (found) return found;
    }
  }
  return null;
};

const getWorkItemTypeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
const toPickerDateValue = (value) => {
  const iso = toIsoOrEmpty(value);
  return iso ? new Date(iso) : null;
};
const fromPickerDateValue = (value) => {
  if (!value) return '';
  return toLocalDateTimeInputValue(value);
};
const getDefaultDateInput = () => toLocalDateTimeInputValue(new Date().toISOString());

const PickerNowAdornment = (props) => {
  const { children, position = 'end', onNowClick, nowLabel = 'Now', ...rest } = props;
  const canRenderNow = position === 'end' && typeof onNowClick === 'function';
  return (
    <InputAdornment
      position={position}
      {...rest}
    >
      {canRenderNow ? (
        <Button
          size='small'
          variant='text'
          color='primary'
          disableRipple
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onNowClick();
          }}
          sx={{
            minWidth: 0,
            p: 0,
            mr: 0.75,
            textTransform: 'none',
            borderRadius: 0,
            fontWeight: 600,
            lineHeight: 1.2,
            '&:hover': {
              backgroundColor: 'transparent',
              textDecoration: 'underline',
            },
          }}
        >
          {nowLabel}
        </Button>
      ) : null}
      {children}
    </InputAdornment>
  );
};

const HistoricalQueryTab = observer(({ store }) => {
  const [mode, setMode] = useState(MODE_AS_OF);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [asOfInput, setAsOfInput] = useState(() => getDefaultDateInput());
  const [baselineInput, setBaselineInput] = useState(() => getDefaultDateInput());
  const [compareToInput, setCompareToInput] = useState(() => getDefaultDateInput());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const historicalControlIndex = 0;

  const queryTreeData = useMemo(() => {
    const list = Array.isArray(store.historicalQueries) ? store.historicalQueries : [];
    return buildHistoricalQueryTree(list);
  }, [store.historicalQueries]);

  const workItemTypesByName = useMemo(() => {
    const map = new Map();
    (Array.isArray(store.workItemTypes) ? store.workItemTypes : []).forEach((type) => {
      const key = getWorkItemTypeKey(type?.name);
      if (key) map.set(key, type);
    });
    return map;
  }, [store.workItemTypes]);

  useEffect(() => {
    if (!store.teamProject) return;
    store.fetchHistoricalQueries();
  }, [store, store.teamProject]);

  useEffect(() => {
    if (!store.teamProject) return;
    store.fetchWorkItemTypeList();
  }, [store, store.teamProject]);

  useEffect(() => {
    if (!selectedQuery?.id) return;
    if (!Array.isArray(queryTreeData) || queryTreeData.length === 0) return;
    const match = findTreeNode(queryTreeData, (node) => node?.id === selectedQuery.id) || null;
    if (!match) {
      setSelectedQuery(null);
      return;
    }
    if (
      selectedQuery?.title !== match.title ||
      selectedQuery?.value !== match.value ||
      selectedQuery?.path !== match.path
    ) {
      setSelectedQuery(match);
    }
  }, [queryTreeData, selectedQuery, selectedQuery?.id]);

  const applySavedData = useCallback(
    async (savedData) => {
      if (!savedData || typeof savedData !== 'object') return;
      const nextMode = savedData.mode === MODE_COMPARE ? MODE_COMPARE : MODE_AS_OF;
      setMode(nextMode);
      if (typeof savedData.asOfInput === 'string') setAsOfInput(savedData.asOfInput);
      if (typeof savedData.baselineInput === 'string') setBaselineInput(savedData.baselineInput);
      if (typeof savedData.compareToInput === 'string') setCompareToInput(savedData.compareToInput);

      const restoredQuery = savedData.selectedQuery;
      if (restoredQuery?.key || restoredQuery?.text) {
        const queryKey = String(restoredQuery?.key || restoredQuery?.text || '').trim();
        const queryText = String(restoredQuery?.text || restoredQuery?.key || '').trim();
        if (!queryKey && !queryText) {
          setSelectedQuery(null);
          return;
        }
        const match =
          findTreeNode(queryTreeData, (node) => {
            const nodeId = String(node?.id || '').trim();
            const nodeTitle = String(node?.title || '').trim();
            return !!node?.isValidQuery && (nodeId === queryKey || nodeTitle === queryText);
          }) || null;
        setSelectedQuery(
          match || {
            id: queryKey || queryText,
            value: queryKey || queryText,
            title: queryText || queryKey,
            path: restoredQuery?.path || '',
            isValidQuery: true,
          },
        );
      } else {
        setSelectedQuery(null);
      }
    },
    [queryTreeData],
  );

  const resetLocalState = useCallback(() => {
    setMode(MODE_AS_OF);
    setSelectedQuery(null);
    setAsOfInput(getDefaultDateInput());
    setBaselineInput(getDefaultDateInput());
    setCompareToInput(getDefaultDateInput());
  }, []);

  const { isRestoring, restoreReady } = useTabStatePersistence({
    store,
    contentControlIndex: historicalControlIndex,
    applySavedData,
    resetLocalState,
    docType: 'historical-query',
  });

  useEffect(() => {
    store.setHistoricalFavoriteDraft({
      mode,
      selectedQuery: selectedQuery
        ? {
            key: selectedQuery.id,
            text: selectedQuery.title,
            path: selectedQuery.path || '',
          }
        : null,
      asOfInput,
      baselineInput,
      compareToInput,
    });
  }, [
    store,
    mode,
    selectedQuery,
    selectedQuery?.id,
    selectedQuery?.title,
    selectedQuery?.path,
    asOfInput,
    baselineInput,
    compareToInput,
  ]);

  useEffect(() => {
    if (isRestoring || !restoreReady) return;
    store.saveTabSessionState('historical-query', historicalControlIndex, {
      mode,
      selectedQuery: selectedQuery
        ? {
            key: selectedQuery.id,
            text: selectedQuery.title,
            path: selectedQuery.path || '',
          }
        : null,
      asOfInput,
      baselineInput,
      compareToInput,
    });
  }, [
    store,
    isRestoring,
    restoreReady,
    historicalControlIndex,
    mode,
    selectedQuery,
    selectedQuery?.id,
    selectedQuery?.title,
    selectedQuery?.path,
    asOfInput,
    baselineInput,
    compareToInput,
  ]);

  const runAsOf = async () => {
    const queryId = selectedQuery?.id;
    const asOfIso = toIsoOrEmpty(asOfInput);
    if (!queryId) {
      toast.error('Please select a shared query.');
      return;
    }
    if (!asOfIso) {
      toast.error('Please provide a valid "As Of" date-time.');
      return;
    }
    try {
      const result = await store.fetchHistoricalAsOfResults(queryId, asOfIso);
      toast.success('Historical query snapshot loaded.');
      const skippedCount = Number(result?.skippedWorkItemsCount || 0);
      if (skippedCount > 0) {
        toast.info(
          `${skippedCount} work item(s) were excluded because they did not exist at the selected point in time.`,
        );
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || error;
      toast.error(`Failed loading historical query result: ${message}`);
    }
  };

  const runCompare = async () => {
    if (!compareValidation.isValid) {
      toast.error(compareValidation.firstError || 'Please provide valid compare input values.');
      return;
    }
    try {
      const result = await store.fetchHistoricalCompareResults(
        selectedQuery?.id,
        compareValidation.baselineIso,
        compareValidation.compareToIso,
      );
      toast.success('Historical compare completed.');
      const skippedDistinctCount = Number(result?.skippedWorkItems?.totalDistinct || 0);
      if (skippedDistinctCount > 0) {
        toast.info(
          `${skippedDistinctCount} work item(s) were excluded from one or both snapshots because they did not exist at the selected dates.`,
        );
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || error;
      toast.error(`Failed comparing historical query snapshots: ${message}`);
    }
  };

  const downloadCompareReport = async () => {
    const result = store.historicalCompareResult;
    if (!result) {
      toast.error('Run compare first to generate a report.');
      return;
    }
    setIsGeneratingReport(true);
    try {
      await store.generateHistoricalCompareReport({
        queryName: selectedQuery?.title || result?.queryName || '',
      });
      toast.success('Historical compare report generation request submitted.');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || error;
      toast.error(`Failed generating historical compare report: ${message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const clearCompareReport = useCallback(() => {
    store.setHistoricalCompareResult(null);
    setIsGeneratingReport(false);
  }, [store]);

  const clearAsOfResult = useCallback(() => {
    store.setHistoricalAsOfResult(null);
  }, [store]);

  const loadingQueries = !!store.loadingState?.historicalQueriesLoadingState;
  const loadingAsOf = !!store.loadingState?.historicalAsOfLoadingState;
  const loadingCompare = !!store.loadingState?.historicalCompareLoadingState;
  const compareValidation = useMemo(
    () =>
      validateHistoricalCompareInputs({
        selectedQueryId: selectedQuery?.id,
        baselineInput,
        compareToInput,
      }),
    [selectedQuery?.id, baselineInput, compareToInput],
  );
  const hasAsOfResult = !!store.historicalAsOfResult;
  const hasCompareResult = !!store.historicalCompareResult;
  const compareResultIsCurrent = isHistoricalCompareResultCurrent(
    store.historicalCompareResult,
    selectedQuery?.id,
    baselineInput,
    compareToInput,
  );
  const canSendRequest = mode === MODE_COMPARE && compareResultIsCurrent;
  const asOfRows = Array.isArray(store.historicalAsOfResult?.rows) ? store.historicalAsOfResult.rows : [];
  const compareRows = Array.isArray(store.historicalCompareResult?.rows)
    ? store.historicalCompareResult.rows
    : [];
  const asOfSkippedCount = Number(store.historicalAsOfResult?.skippedWorkItemsCount || 0);
  const compareSkippedDistinctCount = Number(
    store.historicalCompareResult?.skippedWorkItems?.totalDistinct || 0,
  );

  const renderWorkItemType = (workItemTypeName) => {
    const text = String(workItemTypeName || '').trim();
    if (!text) return '';
    const typeMeta = workItemTypesByName.get(getWorkItemTypeKey(text)) || null;
    const iconUrl = getWorkItemIconUrl(typeMeta?.icon);
    const iconColor =
      normalizeWorkItemColor(typeMeta?.color) ||
      normalizeWorkItemColor(typeMeta?.icon?.color) ||
      normalizeWorkItemColor(typeMeta?.icon?.foregroundColor) ||
      '#64748b';
    const canUseIcon = iconUrl && isSameOrigin(iconUrl);

    return (
      <Stack
        direction='row'
        spacing={0.75}
        alignItems='center'
      >
        <Box
          sx={{
            width: 16,
            height: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {canUseIcon ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: iconColor,
                WebkitMaskImage: `url(${iconUrl})`,
                maskImage: `url(${iconUrl})`,
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
          ) : (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: iconColor }} />
          )}
        </Box>
        <span>{text}</span>
      </Stack>
    );
  };

  return (
    <Stack
      spacing={2}
      sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}
    >
      <Paper
        elevation={0}
        sx={{ p: { xs: 2, md: 3 } }}
      >
        <Stack spacing={2}>
          <Typography variant='h6'>Historical Query & Compare</Typography>
          <Typography
            variant='body2'
            color='text.secondary'
          >
            Run shared Azure DevOps queries as-of a specific date-time, or compare two date-times with
            noise-control field checks.
          </Typography>
          <Box sx={{ width: '100%' }}>
            <QueryTree
              data={queryTreeData}
              prevSelectedQuery={selectedQuery}
              onSelectedQuery={(query) => {
                setSelectedQuery(query || null);
              }}
              queryType='historical-query'
              queryLabel='Shared Query'
              isLoading={loadingQueries}
              width='100%'
            />
          </Box>

          <Tabs
            value={mode}
            onChange={(_event, value) => setMode(value)}
            aria-label='historical-query-mode'
          >
            <Tab
              value={MODE_AS_OF}
              label='As Of'
            />
            <Tab
              value={MODE_COMPARE}
              label='Compare'
            />
          </Tabs>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
          >
            {hasAsOfResult ? (
              <Chip
                color='primary'
                label={`Snapshot ready: ${store.historicalAsOfResult?.total || 0} items`}
              />
            ) : null}
            {hasCompareResult ? (
              <Chip
                color='primary'
                label={`Compare ready: ${store.historicalCompareResult?.summary?.updatedCount || 0} updated`}
              />
            ) : null}
          </Stack>
          {hasAsOfResult && hasCompareResult ? (
            <Alert
              severity='info'
              sx={{ py: 0.5 }}
            >
              Both results are available. Switch between As Of and Compare tabs to review each output.
            </Alert>
          ) : null}

          {mode === MODE_AS_OF ? (
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ md: 'center' }}
            >
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  ampm
                  format='dd/MM/yyyy hh:mm a'
                  label='As Of'
                  value={toPickerDateValue(asOfInput)}
                  onChange={(value) => setAsOfInput(fromPickerDateValue(value))}
                  slots={{ inputAdornment: PickerNowAdornment }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                    inputAdornment: { onNowClick: () => setAsOfInput(getDefaultDateInput()) },
                  }}
                />
              </LocalizationProvider>
              <Stack
                direction='row'
                spacing={1}
              >
                <Button
                  variant='text'
                  color='inherit'
                  onClick={clearAsOfResult}
                  disabled={!hasAsOfResult || loadingAsOf}
                >
                  Clear
                </Button>
                <Button
                  variant='contained'
                  disabled={loadingAsOf}
                  onClick={runAsOf}
                >
                  {loadingAsOf ? 'Loading…' : 'Run Snapshot'}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                >
                  <Stack
                    direction='row'
                    spacing={1}
                    sx={{ width: '100%' }}
                  >
                    <DateTimePicker
                      ampm
                      format='dd/MM/yyyy hh:mm a'
                      label='Baseline'
                      value={toPickerDateValue(baselineInput)}
                      onChange={(value) => setBaselineInput(fromPickerDateValue(value))}
                      slots={{ inputAdornment: PickerNowAdornment }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!compareValidation.errors.baseline,
                          helperText: compareValidation.errors.baseline,
                        },
                        inputAdornment: { onNowClick: () => setBaselineInput(getDefaultDateInput()) },
                      }}
                    />
                  </Stack>
                  <Stack
                    direction='row'
                    spacing={1}
                    sx={{ width: '100%' }}
                  >
                    <DateTimePicker
                      ampm
                      format='dd/MM/yyyy hh:mm a'
                      label='Compare To'
                      value={toPickerDateValue(compareToInput)}
                      onChange={(value) => setCompareToInput(fromPickerDateValue(value))}
                      slots={{ inputAdornment: PickerNowAdornment }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!compareValidation.errors.compareTo,
                          helperText: compareValidation.errors.compareTo,
                        },
                        inputAdornment: { onNowClick: () => setCompareToInput(getDefaultDateInput()) },
                      }}
                    />
                  </Stack>
                </Stack>
              </LocalizationProvider>
              {compareValidation.errors.query || compareValidation.errors.order ? (
                <Alert
                  severity='warning'
                  sx={{ py: 0.5 }}
                >
                  {compareValidation.errors.query || compareValidation.errors.order}
                </Alert>
              ) : null}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Button
                  variant='contained'
                  disabled={loadingCompare || !compareValidation.isValid}
                  onClick={runCompare}
                >
                  {loadingCompare ? 'Comparing…' : 'Run Compare'}
                </Button>
                <Button
                  variant='text'
                  color='inherit'
                  onClick={clearCompareReport}
                  disabled={!hasCompareResult || loadingCompare || isGeneratingReport}
                >
                  Clear
                </Button>
                <Tooltip
                  title={
                    !hasCompareResult
                      ? 'Run compare first'
                      : !compareResultIsCurrent
                        ? 'Inputs changed. Run compare again.'
                        : ''
                  }
                  arrow
                >
                  <span>
                    <Button
                      variant='outlined'
                      color='primary'
                      endIcon={<SendOutlinedIcon />}
                      onClick={downloadCompareReport}
                      disabled={!canSendRequest || isGeneratingReport}
                    >
                      {isGeneratingReport ? 'Sending…' : 'Send Request'}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
              <Typography
                variant='body2'
                color={canSendRequest ? 'text.secondary' : 'warning.main'}
              >
                {!hasCompareResult
                  ? 'Run compare to enable report generation.'
                  : canSendRequest
                    ? 'Compare is ready. You can send the generation request now.'
                    : 'Inputs changed after compare. Run compare again to refresh the report data.'}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      {mode === MODE_AS_OF && loadingAsOf ? (
        <Paper
          elevation={0}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Stack
            direction='row'
            spacing={1.25}
            alignItems='center'
          >
            <CircularProgress size={20} />
            <Typography
              variant='body2'
              color='text.secondary'
            >
              Loading snapshot results...
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {mode === MODE_AS_OF && store.historicalAsOfResult ? (
        <Paper
          elevation={0}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Stack spacing={1.5}>
            <Typography variant='h6'>
              {store.historicalAsOfResult.queryName} · As Of {formatDateTime(store.historicalAsOfResult.asOf)}
            </Typography>
            <Chip
              label={`Returned Work-Items: ${store.historicalAsOfResult.total || 0}`}
              color='primary'
              sx={{ width: 'fit-content' }}
            />
            {asOfSkippedCount > 0 ? (
              <Alert
                severity='info'
                sx={{ py: 0.5 }}
              >
                {asOfSkippedCount} work item(s) were excluded because they did not exist at the selected point
                in time.
                <Tooltip title='Historical snapshots can only include work items that already existed at the selected As Of timestamp.'>
                  <Box
                    component='span'
                    sx={{ ml: 0.75, display: 'inline-flex', verticalAlign: 'middle', cursor: 'help' }}
                    aria-label='Why were items skipped?'
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                  </Box>
                </Tooltip>
              </Alert>
            ) : null}
            <TableContainer
              component={Paper}
              variant='outlined'
            >
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Work Item Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Area Path</TableCell>
                    <TableCell>Iteration Path</TableCell>
                    <TableCell>Version Id</TableCell>
                    <TableCell>Version Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asOfRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        align='center'
                      >
                        No work items found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {asOfRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{renderWorkItemType(row.workItemType)}</TableCell>
                      <TableCell>
                        <Link
                          href={row.workItemUrl}
                          target='_blank'
                          rel='noreferrer'
                          sx={{ color: 'primary.main' }}
                        >
                          {row.title}
                        </Link>
                      </TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>{row.areaPath}</TableCell>
                      <TableCell>{row.iterationPath}</TableCell>
                      <TableCell>{row.versionId}</TableCell>
                      <TableCell>{formatDateTime(row.versionTimestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
      ) : null}

      {mode === MODE_COMPARE && loadingCompare ? (
        <Paper
          elevation={0}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Stack
            direction='row'
            spacing={1.25}
            alignItems='center'
          >
            <CircularProgress size={20} />
            <Typography
              variant='body2'
              color='text.secondary'
            >
              Comparing snapshots...
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {mode === MODE_COMPARE && store.historicalCompareResult ? (
        <Paper
          elevation={0}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              justifyContent='space-between'
            >
              <Typography variant='h6'>
                {store.historicalCompareResult.queryName} · Compare{' '}
                {formatDateTime(store.historicalCompareResult.baseline?.asOf)} vs{' '}
                {formatDateTime(store.historicalCompareResult.compareTo?.asOf)}
              </Typography>
            </Stack>
            <Stack
              direction='row'
              spacing={1}
              flexWrap='wrap'
              useFlexGap
            >
              <Chip
                label={`Added: ${store.historicalCompareResult.summary?.addedCount || 0}`}
                color='success'
              />
              <Chip
                label={`Deleted: ${store.historicalCompareResult.summary?.deletedCount || 0}`}
                color='error'
              />
              <Chip
                label={`Changed: ${store.historicalCompareResult.summary?.changedCount || 0}`}
                color='warning'
              />
              <Chip label={`No changes: ${store.historicalCompareResult.summary?.noChangeCount || 0}`} />
              <Chip
                label={`Updated total: ${store.historicalCompareResult.summary?.updatedCount || 0}`}
                color='primary'
              />
            </Stack>
            {compareSkippedDistinctCount > 0 ? (
              <Alert
                severity='info'
                sx={{ py: 0.5 }}
              >
                {compareSkippedDistinctCount} work item(s) were excluded from one or both snapshots because
                they did not exist at the selected dates.
                <Tooltip title='An item can appear as Added/Deleted when it exists only on one date. Items missing on both dates are excluded.'>
                  <Box
                    component='span'
                    sx={{ ml: 0.75, display: 'inline-flex', verticalAlign: 'middle', cursor: 'help' }}
                    aria-label='Why were items skipped?'
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                  </Box>
                </Tooltip>
              </Alert>
            ) : null}
            <TableContainer
              component={Paper}
              variant='outlined'
            >
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Work Item Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Baseline Rev</TableCell>
                    <TableCell>Compare To Rev</TableCell>
                    <TableCell>Compare Status</TableCell>
                    <TableCell>Changed Fields</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {compareRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        align='center'
                      >
                        No work items found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {compareRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{renderWorkItemType(row.workItemType)}</TableCell>
                      <TableCell>
                        <Link
                          href={row.workItemUrl}
                          target='_blank'
                          rel='noreferrer'
                          sx={{ color: 'primary.main' }}
                        >
                          {row.title}
                        </Link>
                      </TableCell>
                      <TableCell>{row.baselineRevisionId ?? ''}</TableCell>
                      <TableCell>{row.compareToRevisionId ?? ''}</TableCell>
                      <TableCell>{row.compareStatus}</TableCell>
                      <TableCell>
                        {Array.isArray(row.changedFields) ? row.changedFields.join(', ') : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
      ) : null}

      <RestoreBackdrop
        open={!!isRestoring}
        label='Restoring historical query selection…'
      />
    </Stack>
  );
});

export default HistoricalQueryTab;
