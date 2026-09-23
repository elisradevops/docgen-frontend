import React from 'react';
import { Checkbox, Collapse, FormControlLabel, Stack } from '@mui/material';
import QueryTree from '../QueryTree';
import SectionCard from '../../layout/SectionCard';

/**
 * System overview / known bugs query pickers — extracted from
 * ChangeTableSelector.jsx so Manual SVD and Auto SVD mode (same page, see
 * ChangeTableSelector's mode toggle) share one implementation instead of
 * parallel copies. Purely controlled/presentational: owns no state.
 */
const QueriesSection = ({
  queryTrees,
  queriesRequest,
  includeSystemOverview,
  onIncludeSystemOverviewChange,
  includeKnownBugs,
  onIncludeKnownBugsChange,
  onSelectedSystemOverviewQuery,
  onSelectedKnownBugsQuery,
  loading = false,
}) => (
  <SectionCard
    title='Queries'
    compact
    loading={loading}
    loadingText='Loading queries...'
  >
    <Stack spacing={1}>
      <FormControlLabel
        disabled={loading || !queryTrees.systemOverviewQueryTree || queryTrees.systemOverviewQueryTree?.length === 0}
        control={
          <Checkbox
            checked={includeSystemOverview}
            onChange={(_event, checked) => onIncludeSystemOverviewChange(checked)}
          />
        }
        label='Include system overview'
      />
      <Collapse
        in={includeSystemOverview}
        timeout='auto'
        unmountOnExit
      >
        <QueryTree
          data={queryTrees.systemOverviewQueryTree}
          prevSelectedQuery={queriesRequest?.sysOverviewQuery}
          onSelectedQuery={onSelectedSystemOverviewQuery}
          queryType='system-overview'
          isLoading={loading}
        />
      </Collapse>
      <FormControlLabel
        control={
          <Checkbox
            disabled={loading || !queryTrees.knownBugsQueryTree || queryTrees.knownBugsQueryTree?.length === 0}
            checked={includeKnownBugs}
            onChange={(_event, checked) => onIncludeKnownBugsChange(checked)}
          />
        }
        label='Include known possible bugs'
      />
      <Collapse
        in={includeKnownBugs}
        timeout='auto'
        unmountOnExit
      >
        <QueryTree
          data={queryTrees.knownBugsQueryTree}
          prevSelectedQuery={queriesRequest?.knownBugsQuery}
          onSelectedQuery={onSelectedKnownBugsQuery}
          queryType='known-bugs'
          isLoading={loading}
        />
      </Collapse>
    </Stack>
  </SectionCard>
);

export default QueriesSection;
