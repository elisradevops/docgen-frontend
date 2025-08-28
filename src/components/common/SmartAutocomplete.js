import React, { useMemo, useState, useEffect } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CircularProgress from '@mui/material/CircularProgress';
import { createFilterOptions } from '@mui/material/Autocomplete';
import Highlighter from 'react-highlight-words';
import { IconButton, Tooltip } from '@mui/material';
import { FaHistory, FaSortAlphaDown, FaSortAlphaUpAlt } from 'react-icons/fa';

const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;

// Safe getter for nested keys like 'a.b.c'
function get(obj, path) {
  if (!obj || !path) return '';
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return '';
    cur = cur[p];
  }
  return cur ?? '';
}

// Get the search term as a single string (no longer splitting into words)
function getSearchTerm(input) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().toLowerCase();
}

/**
 * SmartAutocomplete
 * A wrapper over MUI Autocomplete with:
 * - Consistent option labeling and equality via optionLabelKey/optionValueKey
 * - Better search across multiple fields via searchKeys
 * - Optional checkbox rendering for multiple selection
 * - Debounced onSearch for remote filtering
 * - Optional client-side sorting (by label or custom comparator)
 */
export default function SmartAutocomplete({
  options = [],
  value,
  onChange,
  label,
  placeholder,
  multiple = false,
  loading = false,
  disableClearable = false,
  optionLabelKey = 'text',
  optionValueKey = 'key',
  // Custom label getter takes precedence over optionLabelKey
  getOptionLabel: getOptionLabelProp,
  isOptionEqualToValue: isOptionEqualToValueProp,
  searchKeys,
  showCheckbox = false,
  onSearch, // (term) => void, debounced
  searchDebounceMs = 300,
  textFieldProps = {},
  renderOption: renderOptionProp,
  filterOptions: filterOptionsProp,
  noOptionsText = 'No options',
  ListboxProps,
  highlightMatches = true,
  highlightStyle = { backgroundColor: 'rgba(255, 235, 59, 0.35)' },
  // Sorting controls
  sortByLabel = false,
  sortDirection = 'asc', // 'asc' | 'desc'
  sortComparator, // (a, b) => number
  // Internal sort toggle UI
  showSortToggle = false,
  // 'default' | 'name-asc' | 'name-desc' ("name" maps to 'name-asc' for backward-compat)
  initialSortMode = 'default',
  // Tooltips per mode
  sortToggleTooltips = { default: 'Commit history', 'name-asc': 'Name (A→Z)', 'name-desc': 'Name (Z→A)' },
  // Optional custom icons per mode
  sortToggleIcons,
  onSortModeChange,
  ...autocompleteProps
}) {
  const [inputValue, setInputValue] = useState('');
  const normalizedInitialMode = initialSortMode === 'name' ? 'name-asc' : initialSortMode;
  const [internalSortMode, setInternalSortMode] = useState(normalizedInitialMode);

  // Debounce external onSearch
  useEffect(() => {
    if (!onSearch) return;
    const t = setTimeout(() => onSearch(inputValue), searchDebounceMs);
    return () => clearTimeout(t);
  }, [inputValue, onSearch, searchDebounceMs]);

  const effectiveGetOptionLabel = useMemo(() => {
    if (typeof getOptionLabelProp === 'function') return getOptionLabelProp;
    return (option) => String(get(option, optionLabelKey) ?? '');
  }, [getOptionLabelProp, optionLabelKey]);

  const effectiveIsOptionEqual = useMemo(() => {
    if (typeof isOptionEqualToValueProp === 'function') return isOptionEqualToValueProp;
    return (option, v) => get(option, optionValueKey) === get(v, optionValueKey);
  }, [isOptionEqualToValueProp, optionValueKey]);

  const effectiveFilterOptions = useMemo(() => {
    if (typeof filterOptionsProp === 'function') return filterOptionsProp;
    const keys =
      Array.isArray(searchKeys) && searchKeys.length > 0 ? searchKeys : [optionLabelKey, optionValueKey];
    
    // Custom filter function for single substring matching
    return (options, { inputValue, getOptionLabel }) => {
      if (!inputValue || !inputValue.trim()) return options;
      
      const searchTerm = inputValue.trim().toLowerCase();
      if (searchTerm.length === 0) return options;
      
      return options.filter(option => {
        // Get all searchable text for this option
        const labelText = String(effectiveGetOptionLabel(option) ?? '');
        const extraKeys = keys.filter(k => k !== optionLabelKey);
        const extra = extraKeys.map((k) => String(get(option, k)));
        const allText = [labelText, ...extra].filter(Boolean).join(' ').trim();
        
        // Normalize the text for matching
        const normalizedText = allText.toLowerCase();
        
        // Single substring matching - treat entire input as one search term
        // "est pro" will match "test project" as a substring
        return normalizedText.includes(searchTerm);
      });
    };
  }, [filterOptionsProp, searchKeys, optionLabelKey, optionValueKey, effectiveGetOptionLabel]);

  // Compute sorted options if requested
  const displayOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    let arr = options;
    let cmp = null;
    if (showSortToggle) {
      // Internal toggle drives sorting
      if (internalSortMode === 'name-asc' || internalSortMode === 'name-desc') {
        const base = (a, b) =>
          String(effectiveGetOptionLabel(a) ?? '').localeCompare(
            String(effectiveGetOptionLabel(b) ?? ''),
            undefined,
            { numeric: true, sensitivity: 'base' }
          );
        const asc = internalSortMode === 'name-asc';
        cmp = asc ? base : (a, b) => -base(a, b);
      }
    } else {
      // Backward-compat props-based sorting
      if (typeof sortComparator === 'function') {
        cmp = sortComparator;
      } else if (sortByLabel) {
        const base = (a, b) =>
          String(effectiveGetOptionLabel(a) ?? '').localeCompare(
            String(effectiveGetOptionLabel(b) ?? ''),
            undefined,
            { numeric: true, sensitivity: 'base' }
          );
        cmp = sortDirection === 'desc' ? (a, b) => -base(a, b) : base;
      }
    }
    if (!cmp) return arr;
    return [...arr].sort(cmp);
  }, [options, sortComparator, sortByLabel, sortDirection, effectiveGetOptionLabel, showSortToggle, internalSortMode]);

  const defaultRenderOption = (props, option, state) => {
    const labelText = String(effectiveGetOptionLabel(option) ?? '');
    const searchTerm = getSearchTerm(inputValue);
    const content =
      highlightMatches && inputValue && searchTerm.length > 0 ? (
        <Highlighter
          highlightStyle={highlightStyle}
          searchWords={[searchTerm]} // Single search term instead of multiple words
          autoEscape
          caseSensitive={false}
          textToHighlight={labelText}
        />
      ) : (
        labelText
      );

    if (!multiple || !showCheckbox) {
      return (
        <li {...props}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
        </li>
      );
    }
    return (
      <li {...props}>
        <Checkbox
          icon={icon}
          checkedIcon={checkedIcon}
          style={{ marginRight: 8 }}
          checked={state.selected}
        />
        <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
      </li>
    );
  };

  const wrappedRenderOption = (props, option, state) => {
    if (renderOptionProp) {
      // Inject inputValue for consumers that want to highlight
      return renderOptionProp(props, option, { ...state, inputValue });
    }
    return defaultRenderOption(props, option, state);
  };

  const currentIcon = (() => {
    if (sortToggleIcons && sortToggleIcons[internalSortMode]) return sortToggleIcons[internalSortMode];
    if (internalSortMode === 'default') return <FaHistory size={16} />;
    if (internalSortMode === 'name-desc') return <FaSortAlphaUpAlt size={16} />; // Z→A
    return <FaSortAlphaDown size={16} />; // A→Z
  })();

  const cycleMode = () => {
    const next = internalSortMode === 'default' ? 'name-asc' : internalSortMode === 'name-asc' ? 'name-desc' : 'default';
    setInternalSortMode(next);
    onSortModeChange && onSortModeChange(next);
  };

  const auto = (
    <Autocomplete
      options={displayOptions}
      value={value}
      multiple={multiple}
      loading={loading}
      disabled={loading} // Disable selection when loading
      disableClearable={disableClearable}
      filterOptions={effectiveFilterOptions}
      isOptionEqualToValue={effectiveIsOptionEqual}
      getOptionLabel={effectiveGetOptionLabel}
      renderOption={wrappedRenderOption}
      inputValue={inputValue}
      onInputChange={(_e, v) => setInputValue(v)}
      noOptionsText={loading ? 'Loading...' : noOptionsText}
      ListboxProps={ListboxProps}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress
                    color='inherit'
                    size={16}
                  />
                ) : null}
                {showSortToggle && (
                  <Tooltip title={sortToggleTooltips?.[internalSortMode] ?? ''}>
                    <IconButton size='small' onClick={cycleMode} edge='end' tabIndex={-1}>
                      {currentIcon}
                    </IconButton>
                  </Tooltip>
                )}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          {...textFieldProps}
        />
      )}
      onChange={onChange}
      {...autocompleteProps}
    />
  );
  return auto;
}

// Static helper method for consistent highlighting in custom renderOption implementations
SmartAutocomplete.renderHighlightedText = (text, inputValue, highlightStyle = { backgroundColor: 'rgba(255, 235, 59, 0.35)' }) => {
  if (!inputValue || !inputValue.trim()) {
    return text;
  }
  
  const searchTerm = inputValue.trim().toLowerCase();
  if (!searchTerm) {
    return text;
  }
  
  return (
    <Highlighter
      highlightStyle={highlightStyle}
      searchWords={[searchTerm]}
      autoEscape
      caseSensitive={false}
      textToHighlight={text}
    />
  );
};
