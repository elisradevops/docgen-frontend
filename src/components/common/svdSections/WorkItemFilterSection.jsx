import React from 'react';
import { Button, Checkbox, Collapse, FormControlLabel, Stack } from '@mui/material';
import SmartAutocomplete from '../SmartAutocomplete';
import SettingsDisplay from '../SettingsDisplay';
import SectionCard from '../../layout/SectionCard';

/**
 * Work item type/state filter — extracted from ChangeTableSelector.jsx so the
 * Manual SVD picker and the Auto SVD mode (same page, see ChangeTableSelector's
 * mode toggle) render the exact same component instead of parallel copies.
 * Purely controlled/presentational: owns no state, so extracting it here does
 * not change who owns/restores the underlying selection (still the parent).
 */
const WorkItemFilterSection = ({
  includeWorkItemFilter,
  onIncludeChange,
  selectedWorkItemTypes,
  onTypesChange,
  selectedWorkItemStates,
  onStatesChange,
  workItemTypeOptions,
  workItemStateOptions,
  loading = false,
}) => {
  const workItemFilterSummary = includeWorkItemFilter
    ? [
        selectedWorkItemTypes.length
          ? selectedWorkItemTypes.length === workItemTypeOptions.length
            ? 'Types: All'
            : `Types (${selectedWorkItemTypes.length}): ${selectedWorkItemTypes
                .map((type) => type.text || type.name)
                .join(', ')}`
          : 'Types: All',
        selectedWorkItemStates.length
          ? selectedWorkItemStates.length === workItemStateOptions.length
            ? 'States: All'
            : `States (${selectedWorkItemStates.length}): ${selectedWorkItemStates
                .map((state) => state.text || state.name)
                .join(', ')}`
          : 'States: All',
      ]
    : [];

  return (
    <SectionCard
      title='Work item filters'
      compact
    >
      <Stack spacing={1.25}>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeWorkItemFilter}
              onChange={(_event, checked) => {
                onIncludeChange(checked);
                if (!checked) {
                  onTypesChange([]);
                  onStatesChange([]);
                }
              }}
            />
          }
          label='Filter changes by work item type and state'
        />
        <Collapse
          in={includeWorkItemFilter}
          timeout='auto'
          unmountOnExit
        >
          <Stack spacing={1.25}>
            <Stack
              direction='row'
              spacing={1}
              flexWrap='wrap'
            >
              <Button
                size='small'
                onClick={() => onTypesChange([...workItemTypeOptions])}
                disabled={workItemTypeOptions.length === 0}
              >
                Select all types
              </Button>
              <Button
                size='small'
                onClick={() => {
                  onTypesChange([]);
                  onStatesChange([]);
                }}
                disabled={selectedWorkItemTypes.length === 0 && selectedWorkItemStates.length === 0}
              >
                Clear selection
              </Button>
            </Stack>
            <SmartAutocomplete
              multiple
              showCheckbox
              autoHighlight
              openOnFocus
              options={workItemTypeOptions}
              value={selectedWorkItemTypes}
              loading={loading}
              label='Work item type'
              placeholder='Select a work item type'
              workItemVisualMode
              disableCloseOnSelect
              onChange={(_event, newValue) => onTypesChange(Array.isArray(newValue) ? newValue : [])}
              noOptionsText='No work item types available'
            />
            <Stack
              direction='row'
              spacing={1}
              flexWrap='wrap'
            >
              <Button
                size='small'
                onClick={() => onStatesChange([...workItemStateOptions])}
                disabled={workItemStateOptions.length === 0}
              >
                Select all states
              </Button>
              <Button
                size='small'
                onClick={() => onStatesChange([])}
                disabled={selectedWorkItemStates.length === 0}
              >
                Clear states
              </Button>
            </Stack>
            <SmartAutocomplete
              multiple
              showCheckbox
              autoHighlight
              openOnFocus
              options={workItemStateOptions}
              value={selectedWorkItemStates}
              label='Work item state'
              placeholder='Select a work item state'
              disabled={selectedWorkItemTypes.length === 0}
              workItemVisualMode
              disableCloseOnSelect
              onChange={(_event, newValue) => onStatesChange(Array.isArray(newValue) ? newValue : [])}
              noOptionsText={
                selectedWorkItemTypes.length > 0
                  ? 'No states available for the selected types'
                  : 'Select at least one work item type first'
              }
            />
          </Stack>
        </Collapse>
        <SettingsDisplay
          title='Configured values'
          settings={workItemFilterSummary}
          emptyMessage='Work item filters disabled.'
          boxProps={{ p: 0, bgcolor: 'transparent' }}
        />
      </Stack>
    </SectionCard>
  );
};

export default WorkItemFilterSection;
