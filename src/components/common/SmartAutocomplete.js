import React, { useMemo, useState, useEffect } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CircularProgress from '@mui/material/CircularProgress';
import { createFilterOptions } from '@mui/material/Autocomplete';
import Highlighter from 'react-highlight-words';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

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

/**
 * SmartAutocomplete
 * A wrapper over MUI Autocomplete with:
 * - Consistent option labeling and equality via optionLabelKey/optionValueKey
 * - Better search across multiple fields via searchKeys
 * - Optional checkbox rendering for multiple selection
 * - Debounced onSearch for remote filtering
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
  ...autocompleteProps
}) {
  const [inputValue, setInputValue] = useState('');

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
      (Array.isArray(searchKeys) && searchKeys.length > 0)
        ? searchKeys
        : [optionLabelKey, optionValueKey];
    return createFilterOptions({
      stringify: (option) => {
        // Always include the label text to ensure typing matches what users see
        const labelText = String(effectiveGetOptionLabel(option) ?? '');
        const extra = keys.map((k) => String(get(option, k)));
        return [labelText, ...extra].join(' ').trim();
      },
      trim: true,
    });
  }, [filterOptionsProp, searchKeys, optionLabelKey, optionValueKey, effectiveGetOptionLabel]);

  const defaultRenderOption = (props, option, state) => {
    const labelText = String(effectiveGetOptionLabel(option) ?? '');
    const content = highlightMatches && inputValue
      ? (
          <Highlighter
            highlightStyle={highlightStyle}
            searchWords={inputValue.trim().split(/\s+/).filter(Boolean)}
            autoEscape
            textToHighlight={labelText}
          />
        )
      : labelText;

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

  return (
    <Autocomplete
      options={options}
      value={value}
      multiple={multiple}
      loading={loading}
      disableClearable={disableClearable}
      filterOptions={effectiveFilterOptions}
      isOptionEqualToValue={effectiveIsOptionEqual}
      getOptionLabel={effectiveGetOptionLabel}
      renderOption={wrappedRenderOption}
      inputValue={inputValue}
      onInputChange={(_e, v) => setInputValue(v)}
      noOptionsText={noOptionsText}
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
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
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
}
