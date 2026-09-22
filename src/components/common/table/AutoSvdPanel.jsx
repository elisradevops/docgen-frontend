import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormLabel,
  Grid,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SmartAutocomplete from '../SmartAutocomplete';
import SectionCard from '../../layout/SectionCard';
import ToggleCard from '../ToggleCard';
import SettingsDisplay from '../SettingsDisplay';
import PipelineSetupResultDialog from '../../dialogs/PipelineSetupResultDialog';
import AutoSvdAdditionalSettingsDialog from '../../dialogs/AutoSvdAdditionalSettingsDialog';
import { buildClassicReleaseSnippet } from '../../../lib/pipelineSetup/buildClassicReleaseSnippet';
import { buildYamlSnippet } from '../../../lib/pipelineSetup/buildYamlSnippet';
import { DEFAULT_PIPELINE_SETUP_EXTRAS, getPipelineSetupExtrasErrors } from '../../../lib/pipelineSetup/pipelineSetupExtras';
import C from '../../../store/constants';
import {
  compareNamesNatural,
  compareNamesNaturalDesc,
  filterHistoryAfter,
  filterHistoryBefore,
} from '../selectors/historyRangeUtils';

const emptyItem = { key: '', text: '' };

/**
 * Auto SVD mode's own content — Range/Surface/Email/Artifactory/extras and the
 * "Generate Snippet" action. This is the *only* section genuinely new
 * relative to Manual SVD: PipelineSelector.jsx/ReleaseSelector.jsx
 * hard-validate an explicit From/To pick, which would defeat Auto SVD's
 * whole reason to exist (auto-discovery when From/To are left blank).
 *
 * Work item filters / Queries / Wiki file / Linked work items are NOT
 * duplicated here — ChangeTableSelector.jsx renders those once, in a column
 * that doesn't change between modes, and passes their current values in via
 * props so this panel can fold them into the generated snippet.
 */
const AutoSvdPanel = observer(
  forwardRef(function AutoSvdPanel(
    {
      store,
      selectedTeamProject,
      workItemFilterOptions,
      queriesRequest,
      attachmentWikiUrl,
      linkedWiOptions,
      includeCommittedBy,
      onIncludeCommittedByChange,
      includeUnlinkedCommits,
      onIncludeUnlinkedCommitsChange,
      includePullRequestWorkItems,
      onIncludePullRequestWorkItemsChange,
      replaceTaskWithParent,
      onReplaceTaskWithParentChange,
      onValidityChange,
    },
    ref
  ) {
    // Range type is the primary choice (mirrors Manual SVD's own Base Data
    // type selector — pick what you're comparing first). Surface is
    // secondary: Pipeline Range only exists as a YAML template (Classic
    // Release always auto-detects the *release* it's running in, so it has
    // no pipeline-range equivalent at all) — Release Range is the one place
    // a real choice exists, and PowerShell/Classic Release is its default.
    const [rangeType, setRangeType] = useState('release'); // 'release' | 'pipeline'
    const [surface, setSurface] = useState('classicRelease'); // 'classicRelease' | 'yaml' — only meaningful for 'release'

    const [selectedDefinition, setSelectedDefinition] = useState(emptyItem);
    const [history, setHistory] = useState([]);
    const [fromValue, setFromValue] = useState(emptyItem);
    const [toValue, setToValue] = useState(emptyItem);
    const [compareMode, setCompareMode] = useState('consecutive');

    const [extras, setExtras] = useState(DEFAULT_PIPELINE_SETUP_EXTRAS);
    const setExtra = useCallback((key, value) => setExtras((prev) => ({ ...prev, [key]: value })), []);

    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [resultDialogOpen, setResultDialogOpen] = useState(false);
    const [result, setResult] = useState(null);

    // Guards against an out-of-order response: if the user picks another
    // definition (or the range type is switched) before the first request
    // resolves, only the most recently requested definition's data is
    // allowed to land.
    const historyRequestRef = useRef(0);

    const clearRangeState = () => {
      historyRequestRef.current += 1; // invalidate any in-flight history fetch
      setSelectedDefinition(emptyItem);
      setFromValue(emptyItem);
      setToValue(emptyItem);
      setHistory([]);
    };

    const handleRangeTypeChange = (_e, next) => {
      if (!next) return;
      setRangeType(next);
      // Pipeline Range only exists as YAML; Release Range defaults back to
      // Classic Release (PowerShell) — see the comment on the state above.
      setSurface(next === 'pipeline' ? 'yaml' : 'classicRelease');
      clearRangeState(); // the previous pick belongs to a different definition list
    };

    const handleSurfaceChange = (_e, next) => {
      if (!next) return;
      setSurface(next);
      // Both surfaces target the *same* release range here, so the picked
      // release/from/to stay valid — no reason to clear them.
    };

    const handleDefinitionChange = async (_event, newValue) => {
      historyRequestRef.current += 1; // invalidate any in-flight history fetch (e.g. clearing mid-request)
      setSelectedDefinition(newValue || emptyItem);
      setFromValue(emptyItem);
      setToValue(emptyItem);
      setHistory([]);
      if (!newValue?.key) return;
      const requestId = ++historyRequestRef.current;
      const data =
        rangeType === 'release'
          ? await store.fetchReleaseDefinitionHistory(newValue.key)
          : await store.fetchPipelineRunHistory(newValue.key);
      if (requestId !== historyRequestRef.current) return; // superseded by a newer pick
      setHistory(data || []);
    };

    // Mirrors ReleaseSelector.jsx/PipelineSelector.jsx: picking one end of the
    // range filters the other picker down to only the runs that keep the
    // range valid (end after start). Manual SVD only ever fills start first,
    // so it only needs one direction; Auto SVD lets either be picked first
    // (both stay optional), so this filters both ways.
    const handleFromChange = (_e, v) => {
      const next = v || emptyItem;
      setFromValue(next);
      if (next?.key && toValue?.key && Number(toValue.key) <= Number(next.key)) {
        setToValue(emptyItem); // no longer after the new start
      }
    };

    const handleToChange = (_e, v) => {
      const next = v || emptyItem;
      setToValue(next);
      if (next?.key && fromValue?.key && Number(fromValue.key) >= Number(next.key)) {
        setFromValue(emptyItem); // no longer before the new end
      }
    };

    const definitionOptions = (rangeType === 'release' ? store.releaseDefinitionList : store.pipelineList) || [];
    const definitionListMapped = Array.from(definitionOptions)
      .slice()
      .sort(compareNamesNatural)
      .map((item) => ({ key: item.id, text: `${item.id} - ${item.name}` }));
    const fromOptions = (toValue?.key ? filterHistoryBefore(history, toValue.key) : [...history].sort(compareNamesNaturalDesc)).map(
      (run) => ({ key: run.id, text: run.name })
    );
    const toOptions = (fromValue?.key ? filterHistoryAfter(history, fromValue.key) : [...history].sort(compareNamesNatural)).map(
      (run) => ({ key: run.id, text: run.name })
    );

    const showYamlReleaseWarn = surface === 'yaml' && rangeType === 'release';

    const handleGenerateSnippet = () => {
      // From/To only ever come from the friendly picker below, which only
      // appears once a definition is selected — otherwise they stay blank,
      // which is exactly the auto-discover default.
      const from = fromValue?.key ?? '';
      const to = toValue?.key ?? '';

      const contentControlData = {
        rangeType,
        ...(rangeType === 'release'
          ? { selectedRelease: selectedDefinition?.key ? selectedDefinition : undefined, compareMode }
          : { selectedPipeline: selectedDefinition?.key ? selectedDefinition : undefined }),
        from,
        to,
        systemOverviewQuery: queriesRequest,
        attachmentWikiUrl,
        linkedWiOptions,
        workItemFilterOptions,
        includeCommittedBy,
        includeUnlinkedCommits,
        includePullRequestWorkItems,
        replaceTaskWithParent,
      };

      const context = {
        orgUrl: store.adoOrgUrl || '',
        apiUrl: C.jsonDocument_url ? `${C.jsonDocument_url}/jsonDocument/create` : '',
        project: selectedTeamProject?.text || '',
        pipelineName:
          rangeType === 'pipeline' ? selectedDefinition?.text?.split(' - ').slice(1).join(' - ') : '',
      };

      const extrasErrors = getPipelineSetupExtrasErrors(extras, surface);
      const builder = surface === 'yaml' ? buildYamlSnippet : buildClassicReleaseSnippet;
      const built = builder(contentControlData, context, extras);
      built.errors = [...extrasErrors, ...(built.errors || [])];

      setResult(built);
      setResultDialogOpen(true);
    };

    // Exposed so the page's single footer bar (ChangeTableSelector ->
    // DocFormGenerator) can trigger this in place of "Send Request" when in
    // Auto SVD mode, instead of this panel owning a second action bar.
    useImperativeHandle(ref, () => ({ generateSnippet: handleGenerateSnippet }));

    const additionalSettingsSummary = [
      extras.excludedRepoNames?.trim() && `Excluded repositories: ${extras.excludedRepoNames.trim()}`,
      extras.sendEmail && `Email: ${extras.mailTo?.trim() || '(mail to required)'}`,
      surface === 'classicRelease' && extras.uploadToJfrog && 'Artifactory upload enabled',
      surface === 'yaml' && extras.publishJfrog && 'Artifactory publish enabled',
    ].filter(Boolean);
    const additionalSettingsErrors = getPipelineSetupExtrasErrors(extras, surface);
    const additionalSettingsErrorsKey = additionalSettingsErrors.join('|');

    // Reports up to ChangeTableSelector -> DocFormGenerator so the page's
    // single footer button can be disabled the same way Manual SVD's "Send
    // Request" is — without this, "Generate Snippet" could be clicked past
    // an unresolved error (e.g. email on with no Mail To) that only surfaces
    // afterward, inside the result dialog.
    useEffect(() => {
      onValidityChange && onValidityChange(additionalSettingsErrors);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [additionalSettingsErrorsKey, onValidityChange]);

    return (
      <Stack spacing={1.5}>
        <SectionCard
          title='Range type'
          description='Pick what this snippet compares: a release history, or a pipeline (build) history.'
        >
          <Stack spacing={1.5}>
            <Stack
              direction='row'
              spacing={1.5}
              alignItems='center'
              flexWrap='wrap'
              useFlexGap
            >
              <ToggleButtonGroup
                color='primary'
                size='small'
                exclusive
                value={rangeType}
                onChange={handleRangeTypeChange}
                aria-label='range type'
              >
                <ToggleButton value='release'>Release Range</ToggleButton>
                <ToggleButton value='pipeline'>Pipeline Range</ToggleButton>
              </ToggleButtonGroup>

              {rangeType === 'release' ? (
                <>
                  <Divider
                    orientation='vertical'
                    flexItem
                  />
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    Snippet format:
                  </Typography>
                  <ToggleButtonGroup
                    color='primary'
                    size='small'
                    exclusive
                    value={surface}
                    onChange={handleSurfaceChange}
                    aria-label='pipeline setup target surface'
                  >
                    <ToggleButton value='classicRelease'>Classic Release (PowerShell)</ToggleButton>
                    <ToggleButton value='yaml'>YAML Pipeline (template)</ToggleButton>
                  </ToggleButtonGroup>
                </>
              ) : (
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  Pipeline Range always uses the YAML pipeline template — Classic Release only supports Release
                  Range.
                </Typography>
              )}
            </Stack>

            {showYamlReleaseWarn && (
              <Alert severity='warning'>
                This path needs the build&apos;s OAuth token to have Release Management read access — that isn&apos;t
                automatic the way Classic Release&apos;s checkbox is, so verify it before relying on this in
                production. (Documented in <code>SVDGenerationGuide.md</code>, &quot;Release SVD from a YAML
                Pipeline&quot; — not yet run against a live release definition.)
              </Alert>
            )}
          </Stack>
        </SectionCard>

        <SectionCard
          title={rangeType === 'release' ? 'Release range' : 'Pipeline range'}
          description='Leave From/To blank — the backend auto-discovers the previous/latest run.'
        >
          <Grid
            container
            spacing={2}
            alignItems='flex-start'
          >
            <Grid size={12}>
              <SmartAutocomplete
                style={{ marginBlock: 8, width: '100%' }}
                autoHighlight
                openOnFocus
                options={definitionListMapped}
                value={selectedDefinition?.key ? selectedDefinition : null}
                onChange={handleDefinitionChange}
                label={rangeType === 'release' ? 'Select a Release (optional)' : 'Select a Pipeline (optional)'}
                placeholder='Pick one to get a friendly From/To picker, or leave unpicked'
              />
            </Grid>

            {/* From/To only appear once a definition is picked — showing a
                plain-text fallback here before that meant the fields visibly
                changed shape (autocomplete <-> plain input) the moment a
                definition was picked, which read as a layout glitch. */}
            {selectedDefinition?.key && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <SmartAutocomplete
                    style={{ marginBlock: 8, width: '100%' }}
                    autoHighlight
                    openOnFocus
                    options={fromOptions}
                    value={fromValue?.key ? fromValue : null}
                    onChange={handleFromChange}
                    label={rangeType === 'release' ? 'Select start release (optional)' : 'Select start pipeline run (optional)'}
                    placeholder='auto-discover'
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <SmartAutocomplete
                    style={{ marginBlock: 8, width: '100%' }}
                    autoHighlight
                    openOnFocus
                    options={toOptions}
                    value={toValue?.key ? toValue : null}
                    onChange={handleToChange}
                    label={rangeType === 'release' ? 'Select end release (optional)' : 'Select end pipeline run (optional)'}
                    placeholder='auto-discover'
                  />
                </Grid>
              </>
            )}

            {rangeType === 'release' && (
              <Grid size={12}>
                <Stack spacing={1.25}>
                  <FormLabel
                    id='auto-svd-compare-mode-label'
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    Comparison mode
                    <Tooltip
                      placement='right'
                      arrow
                      componentsProps={{ tooltip: { sx: { maxWidth: 560 } } }}
                      title={
                        <Box sx={{ fontSize: '0.95rem', lineHeight: 1.6, width: 520 }}>
                          <b>Consecutive (fast):</b> Compares only adjacent releases. Best when artifacts/services
                          exist in most releases.
                          <br />
                          <b>All pairs (slow):</b> Compares every pair. Use for non-adjacent presence; slower and
                          may repeat changes.
                        </Box>
                      }
                    >
                      <IconButton
                        size='small'
                        aria-label='Comparison mode help'
                      >
                        <InfoOutlinedIcon fontSize='inherit' />
                      </IconButton>
                    </Tooltip>
                  </FormLabel>
                  <RadioGroup
                    row
                    value={compareMode}
                    onChange={(e) => setCompareMode(e.target.value)}
                    name='auto-svd-compare-mode'
                    aria-labelledby='auto-svd-compare-mode-label'
                  >
                    <FormControlLabel
                      value='consecutive'
                      control={<Radio />}
                      label='Consecutive (fast)'
                    />
                    <FormControlLabel
                      value='allPairs'
                      control={<Radio />}
                      label='All pairs (slow)'
                    />
                  </RadioGroup>
                </Stack>
              </Grid>
            )}
          </Grid>
        </SectionCard>

        <SectionCard
          title='Content options'
          description='Same commit and work-item options as Manual SVD.'
        >
          <Grid
            container
            spacing={1.5}
            alignItems='stretch'
          >
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <ToggleCard
                icon={LinkOffIcon}
                title='Unlinked commits'
                description='Include commits without linked work items.'
                checked={includeUnlinkedCommits}
                onChange={onIncludeUnlinkedCommitsChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <ToggleCard
                icon={CallMergeIcon}
                title='PR work items'
                description='Merge work items linked only to the PR.'
                checked={includePullRequestWorkItems}
                onChange={onIncludePullRequestWorkItemsChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <ToggleCard
                icon={PersonOutlineIcon}
                title='Committer'
                description='Show the committer column in the table.'
                checked={includeCommittedBy}
                onChange={onIncludeCommittedByChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <ToggleCard
                icon={AccountTreeIcon}
                title='Replace Task'
                description='Replace Task work items with their parent.'
                checked={replaceTaskWithParent}
                onChange={onReplaceTaskWithParentChange}
                info={
                  <Tooltip
                    arrow
                    placement='top'
                    componentsProps={{
                      tooltip: { sx: { maxWidth: 420, p: 1, '& .MuiTypography-root': { lineHeight: 1.35 } } },
                    }}
                    title={
                      <Box>
                        <Typography variant='body2'>
                          When enabled, Task work items are replaced by their immediate parent Requirement (1
                          level).
                        </Typography>
                        <Stack
                          direction='row'
                          alignItems='center'
                          spacing={0.5}
                          sx={{ mt: 0.5 }}
                        >
                          <WarningAmberOutlinedIcon
                            sx={{ color: 'warning.main' }}
                            fontSize='small'
                          />
                          <Typography
                            variant='caption'
                            sx={{ color: 'warning.main', fontWeight: 600 }}
                          >
                            With this mode on, Task items will not be displayed.
                          </Typography>
                        </Stack>
                      </Box>
                    }
                  >
                    <InfoOutlinedIcon
                      fontSize='small'
                      color='info'
                    />
                  </Tooltip>
                }
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard
          title='Additional settings'
          description='Excluded repositories, email, and Artifactory upload.'
          compact
          actions={
            <Button
              size='small'
              variant='text'
              startIcon={<SettingsOutlinedIcon fontSize='small' />}
              onClick={() => setSettingsDialogOpen(true)}
            >
              Configure
            </Button>
          }
        >
          <Stack spacing={1}>
            <SettingsDisplay
              title='Configured values'
              settings={additionalSettingsSummary}
              emptyMessage='No additional settings configured.'
              boxProps={{ p: 0, bgcolor: 'transparent' }}
            />
            {additionalSettingsErrors.length > 0 && (
              <Alert
                severity='error'
                sx={{ py: 0 }}
              >
                {additionalSettingsErrors.join(' ')}
              </Alert>
            )}
          </Stack>
        </SectionCard>

        <AutoSvdAdditionalSettingsDialog
          open={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
          surface={surface}
          extras={extras}
          setExtra={setExtra}
        />

        <PipelineSetupResultDialog
          open={resultDialogOpen}
          onClose={() => setResultDialogOpen(false)}
          surface={surface}
          result={result}
        />
      </Stack>
    );
  })
);

export default AutoSvdPanel;
