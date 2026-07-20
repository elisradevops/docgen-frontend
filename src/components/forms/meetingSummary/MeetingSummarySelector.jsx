import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import { Alert, Chip, Grid, Stack, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SectionCard from '../../layout/SectionCard';
import SettingsDisplay from '../../common/SettingsDisplay';
import QueryTree from '../../common/QueryTree';
import { validateQuery } from '../../../utils/queryValidation';
import useTabStatePersistence from '../../../hooks/useTabStatePersistence';
import {
  buildMeetingSummaryContentControls,
  deriveMeetingSummaryMode,
  isValidMeetingSummaryTemplateName,
} from './meetingSummaryUtils';

const looksLikeQueryTreeNode = (value) => (
  value &&
  typeof value === 'object' &&
  (
    Array.isArray(value.children) ||
    value.isValidQuery === true ||
    value.isFolder === true ||
    typeof value.id !== 'undefined' ||
    typeof value.value !== 'undefined'
  )
);

const collectQueryTreeRoots = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(collectQueryTreeRoots);
  if (typeof value !== 'object') return [];
  if (looksLikeQueryTreeNode(value)) return [value];
  return Object.values(value).flatMap(collectQueryTreeRoots);
};

// SettingsDisplay wants an array of pre-formatted strings, not the raw query object.
const querySettingsLines = (query) =>
  query
    ? [`${query.title || query.value || 'Untitled query'}${query.queryType ? ` · ${query.queryType}` : ''}`]
    : [];

const MeetingSummarySelector = observer(({ store, sharedQueries, onModeChange }) => {
  const [meetingSummaryQuery, setMeetingSummaryQuery] = useState(null);
  const [meetingTasksQuery, setMeetingTasksQuery] = useState(null);
  const [previousOpenTasksQuery, setPreviousOpenTasksQuery] = useState(null);
  const [includePreviousOpenTasks, setIncludePreviousOpenTasks] = useState(false);
  const meetingSummaryQueryId = meetingSummaryQuery?.id || '';
  const meetingTasksQueryId = meetingTasksQuery?.id || '';
  const previousOpenTasksQueryId = previousOpenTasksQuery?.id || '';
  // Depend on the acquiredTrees reference (reassigned wholesale on each fetch), not the outer
  // sharedQueries wrapper (whose identity never changes) — otherwise this memo goes stale.
  const acquiredTrees = sharedQueries?.acquiredTrees;
  const queryTrees = useMemo(
    () => collectQueryTreeRoots(acquiredTrees ?? sharedQueries),
    [acquiredTrees, sharedQueries],
  );
  const isSharedQueriesLoading = !!store.fetchLoadingState?.().sharedQueriesLoadingState;

  // Restore selections on tab switch (sessionStorage, per content-control index) and — best-effort —
  // from a loaded favorite, matching every other selector's use of this hook (e.g. ChangeTableSelector).
  // Restoring only sets a partial {id} node since queryTrees may not be loaded yet; the enrichment effect
  // below fills in the full node (title/queryType) once tree data arrives.
  const applyRestoredQuery = useCallback((dataToSave, expectedSkinType, setQuery) => {
    if (!dataToSave || dataToSave.type !== 'query' || dataToSave.skinType !== expectedSkinType) return;
    if (!dataToSave.queryId) return;
    setQuery({ id: dataToSave.queryId });
  }, []);

  const applySavedDataIndex0 = useCallback(
    (dataToSave) => applyRestoredQuery(dataToSave, 'paragraph', setMeetingSummaryQuery),
    [applyRestoredQuery],
  );
  const resetIndex0 = useCallback(() => setMeetingSummaryQuery(null), []);
  useTabStatePersistence({
    store,
    contentControlIndex: 0,
    applySavedData: applySavedDataIndex0,
    resetLocalState: resetIndex0,
  });

  const applySavedDataIndex1 = useCallback(
    (dataToSave) => applyRestoredQuery(dataToSave, 'table', setMeetingTasksQuery),
    [applyRestoredQuery],
  );
  const resetIndex1 = useCallback(() => setMeetingTasksQuery(null), []);
  useTabStatePersistence({
    store,
    contentControlIndex: 1,
    applySavedData: applySavedDataIndex1,
    resetLocalState: resetIndex1,
  });

  // Index 2 also restores the "Include" toggle. Note: store.saveFavorite() only ever captures
  // contentControls[0] (the paragraph slot) — a favorite's dataToSave here will have skinType
  // 'paragraph' (or be absent), never 'table', so it's naturally ignored rather than misapplied.
  // Session-based (tab-switch) restores are always correctly scoped per index and unaffected.
  const applySavedDataIndex2 = useCallback((dataToSave) => {
    const isTableRestore = !!dataToSave && dataToSave.type === 'query' && dataToSave.skinType === 'table';
    setIncludePreviousOpenTasks(isTableRestore);
    setPreviousOpenTasksQuery(isTableRestore && dataToSave.queryId ? { id: dataToSave.queryId } : null);
  }, []);
  const resetIndex2 = useCallback(() => {
    setPreviousOpenTasksQuery(null);
    setIncludePreviousOpenTasks(false);
  }, []);
  useTabStatePersistence({
    store,
    contentControlIndex: 2,
    applySavedData: applySavedDataIndex2,
    resetLocalState: resetIndex2,
  });

  // Fill in the full query node (title/queryType) for any restored-but-partial {id} selection, once
  // queryTrees has loaded — mirrors QueryTree's own internal "resolve previously selected query" effect.
  useEffect(() => {
    if (!queryTrees.length) return;
    const enrich = (query, setter) => {
      if (query && !query.title && query.id) {
        const found = validateQuery(queryTrees, query);
        if (found) setter(found);
      }
    };
    enrich(meetingSummaryQuery, setMeetingSummaryQuery);
    enrich(meetingTasksQuery, setMeetingTasksQuery);
    enrich(previousOpenTasksQuery, setPreviousOpenTasksQuery);
  }, [queryTrees, meetingSummaryQuery, meetingTasksQuery, previousOpenTasksQuery]);

  // The template picked via the global "Templates" button (MainTabs) is the source of truth.
  // Orientation is derived from its filename, not chosen from a toggle, so it can never override
  // a manual template selection and any number of custom portrait/landscape templates can be used.
  const selectedTemplateName = store.selectedTemplate?.text || store.selectedTemplate?.url || '';
  const derivedMode = useMemo(() => deriveMeetingSummaryMode(selectedTemplateName), [selectedTemplateName]);
  const isTemplateValid = useMemo(
    () => isValidMeetingSummaryTemplateName(selectedTemplateName),
    [selectedTemplateName],
  );

  useEffect(() => {
    if (derivedMode) onModeChange(derivedMode);
  }, [derivedMode, onModeChange]);

  useEffect(() => {
    const requiredReady = !!meetingSummaryQueryId && !!meetingTasksQueryId;
    const controls = requiredReady
      ? buildMeetingSummaryContentControls({
          meetingSummaryQueryId,
          meetingTasksQueryId,
          previousOpenTasksQueryId,
        })
      : [];

    controls.forEach((control, index) => {
      store.addContentControlToDocument(control, index);
    });

    // Every other content-control selector clears the DocFormGenerator pre-seeded 'init' blocker
    // when it sets its own real validation key (see ChangeTableSelector, TestContentSelector, etc.) —
    // without this, 'init' stays isValid:false forever and Send never enables.
    store.setValidationState(0, 'meetingSummaryQuery', {
      isValid: !!meetingSummaryQueryId,
      message: 'Select a Meeting Summary query',
    });
    store.clearValidationForIndex(0, 'init');
    store.setValidationState(1, 'meetingTasksQuery', {
      isValid: !!meetingTasksQueryId,
      message: 'Select a Tasks From The Meeting query',
    });
    store.clearValidationForIndex(1, 'init');
    store.setValidationState(2, 'previousOpenTasksQuery', {
      isValid: true,
      message: '',
    });
    store.clearValidationForIndex(2, 'init');
  }, [meetingSummaryQueryId, meetingTasksQueryId, previousOpenTasksQueryId, store]);

  useEffect(() => {
    store.setValidationState(0, 'meetingSummaryTemplate', {
      isValid: isTemplateValid,
      message:
        'Select a Meeting-Summary template via the Templates button (filename must include "portrait" or "landscape")',
    });
    store.clearValidationForIndex(0, 'init');
  }, [isTemplateValid, store]);

  const isDuplicateQuery =
    !!meetingSummaryQueryId &&
    !!meetingTasksQueryId &&
    meetingSummaryQueryId === meetingTasksQueryId;

  const handleTogglePreviousOpenTasks = (_event, checked) => {
    setIncludePreviousOpenTasks(checked);
    if (!checked) setPreviousOpenTasksQuery(null);
  };

  return (
    <Stack spacing={1.5}>
      <SectionCard
        title='Meeting Summary'
        description='Page orientation is set by the template you pick from the Templates button — choose a portrait or landscape Meeting-Summary template there.'
        actions={
          <Tooltip
            arrow
            placement='top'
            title='Renders results of ADO shared queries into a Word document via predefined content controls — this is structured query rendering, not AI summarization.'
          >
            <InfoOutlinedIcon
              fontSize='small'
              color='info'
            />
          </Tooltip>
        }
        compact
      >
        <Stack spacing={1}>
          {derivedMode ? (
            <Chip
              size='small'
              label={`Orientation: ${derivedMode === 'landscape' ? 'Landscape' : 'Portrait'}`}
              sx={{ width: 'fit-content' }}
            />
          ) : null}
          {!isTemplateValid ? (
            <Alert severity='warning'>
              No valid Meeting-Summary template selected. Use the <strong>Templates</strong> button to
              pick a .docx or .dotx file whose name includes "meeting-summary" and either "portrait" or
              "landscape".
            </Alert>
          ) : null}
        </Stack>
      </SectionCard>

      {isDuplicateQuery ? (
        <Alert severity='warning'>
          Same query selected for Meeting Summary and Tasks From The Meeting — both sections will render
          identical content.
        </Alert>
      ) : null}

      <Grid
        container
        spacing={1.5}
      >
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <SectionCard
            title='Meeting Summary Query'
            description='Renders as narrative paragraphs.'
            loading={isSharedQueriesLoading}
            loadingText='Loading queries…'
            compact
          >
            <Stack spacing={1}>
              <SettingsDisplay
                title='Selected query'
                settings={querySettingsLines(meetingSummaryQuery)}
                emptyMessage='No query selected yet.'
                boxProps={{ p: 0, bgcolor: 'transparent' }}
              />
              <QueryTree
                data={queryTrees}
                prevSelectedQuery={meetingSummaryQuery}
                onSelectedQuery={setMeetingSummaryQuery}
                queryLabel='Meeting Summary'
                isLoading={isSharedQueriesLoading}
                width='100%'
              />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <SectionCard
            title='Tasks From The Meeting Query'
            description='Renders as a flat table.'
            loading={isSharedQueriesLoading}
            loadingText='Loading queries…'
            compact
          >
            <Stack spacing={1}>
              <SettingsDisplay
                title='Selected query'
                settings={querySettingsLines(meetingTasksQuery)}
                emptyMessage='No query selected yet.'
                boxProps={{ p: 0, bgcolor: 'transparent' }}
              />
              <QueryTree
                data={queryTrees}
                prevSelectedQuery={meetingTasksQuery}
                onSelectedQuery={setMeetingTasksQuery}
                queryLabel='Tasks From The Meeting'
                isLoading={isSharedQueriesLoading}
                width='100%'
              />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 12, lg: 4 }}>
          <SectionCard
            title='Open Tasks From Previous Meetings Query'
            description='Renders as a flat table.'
            enableToggle='Include'
            enabled={includePreviousOpenTasks}
            onToggle={handleTogglePreviousOpenTasks}
            loading={isSharedQueriesLoading}
            loadingText='Loading queries…'
            compact
          >
            {includePreviousOpenTasks ? (
              <Stack spacing={1}>
                <SettingsDisplay
                  title='Selected query'
                  settings={querySettingsLines(previousOpenTasksQuery)}
                  emptyMessage='No query selected yet.'
                  boxProps={{ p: 0, bgcolor: 'transparent' }}
                />
                <QueryTree
                  data={queryTrees}
                  prevSelectedQuery={previousOpenTasksQuery}
                  onSelectedQuery={setPreviousOpenTasksQuery}
                  queryLabel='Open Tasks From Previous Meetings'
                  isLoading={isSharedQueriesLoading}
                  width='100%'
                />
              </Stack>
            ) : (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Enable to select open tasks carried over from a previous meeting.
              </Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
});

export default MeetingSummarySelector;
