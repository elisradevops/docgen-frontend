import React, { useMemo, useState, useEffect, useRef } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CircularProgress from '@mui/material/CircularProgress';
import { IconButton, Tooltip } from '@mui/material';
import { FaHistory, FaSortAlphaDown, FaSortAlphaUpAlt } from 'react-icons/fa';
import {
  getSearchTerm,
  createSubstringFilterFn,
  createLabelComparator,
  createAdaptiveListboxComponent,
} from '../../utils/smartAutocompleteHelpers';

const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;

/**
 * SmartAutocomplete – thin wrapper around MUI Autocomplete with consistent filtering,
 * sorting, highlighting, and virtualization for large lists.
 *
 * Data shape (required):
 *   options: Array<{ key: string|number, text: string, ...extras }>
 *   value:   { key, text } | Array<{ key, text }>
 *
 * Common props:
 * - searchKeys?: string[]            // extra fields to include in client filter
 * - minCharsToSearch?: number        // gate filtering until N chars (default 0)
 * - maxResults?: number              // cap filtered results
 * - filterOptions?: (opts, ctx) => opts // override filtering entirely
 * - sortByLabel?: boolean            // sort by label when no toggle is shown
 * - sortDirection?: 'asc' | 'desc'
 * - showSortToggle?: boolean         // internal toggle: default | name-asc | name-desc
 * - clientDebounceMs?: number        // debounce client-side filtering
 * - virtualize?: boolean             // force virtualization
 * - virtualizeIfOver?: number        // auto-virtualize when filtered count >= threshold
 * - virtualizeOnInput?: boolean      // auto-virtualize while typing (default true)
 * - virtualizeMinInputLength?: number// threshold to enable virtualization on input (default 1)
 *
 * Minimal usage:
 *   <SmartAutocomplete
 *     options={[ { key: 1, text: 'Item A' }, { key: 2, text: 'Item B' } ]}
 *     value={selected}
 *     onChange={(_, v) => setSelected(v)}
 *     label='Select an item'
 *   />
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
  groupBy,
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
  // Large-list controls
  minCharsToSearch = 0,
  maxResults,
  // Client-side debounce for filtering (ms). 0 disables.
  clientDebounceMs = 0,
  // Virtualization controls
  virtualize = false,
  // Use a slightly taller default row height to match MUI option rows with checkboxes
  rowHeight = 48,
  overScanCount = 5,
  maxVisibleRows = 8,
  // Enable virtualization automatically if options.length >= this number (takes effect when provided)
  virtualizeIfOver,
  // Enable virtualization when user starts typing (based on input length)
  virtualizeOnInput = true,
  virtualizeMinInputLength = 1,
  // Log to console when virtualization toggles (dev aid)
  debugVirtualization = false,
  ...autocompleteProps
}) {
  const [inputValue, setInputValue] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const inputElRef = useRef(null);
  const normalizedInitialMode = initialSortMode === 'name' ? 'name-asc' : initialSortMode;
  const [internalSortMode, setInternalSortMode] = useState(normalizedInitialMode);

  // Debounced filter term used for client-side filtering to reduce work on each keystroke
  const [debouncedFilterTerm, setDebouncedFilterTerm] = useState('');
  useEffect(() => {
    if (!clientDebounceMs || clientDebounceMs <= 0) {
      setDebouncedFilterTerm(filterTerm);
      return;
    }
    const t = setTimeout(() => setDebouncedFilterTerm(filterTerm), clientDebounceMs);
    return () => clearTimeout(t);
  }, [filterTerm, clientDebounceMs]);

  // Use the same source for filtering, highlighting, and minChars checks
  const inputForFiltering = useMemo(
    () => (clientDebounceMs && clientDebounceMs > 0 ? debouncedFilterTerm : filterTerm),
    [clientDebounceMs, debouncedFilterTerm, filterTerm]
  );

  // Debounce external onSearch
  useEffect(() => {
    if (!onSearch) return;
    const t = setTimeout(() => onSearch(inputValue), searchDebounceMs);
    return () => clearTimeout(t);
  }, [inputValue, onSearch, searchDebounceMs]);

  // Standard label resolver for { key, text } options
  const getOptionLabelFn = useMemo(() => (option) => String(option?.text ?? ''), []);

  // Standard equality resolver for { key, text } options
  const isOptionEqualFn = useMemo(() => (option, v) => option?.key === v?.key, []);

  const hasCustomFilter = typeof filterOptionsProp === 'function';
  const defaultFilterOptions = createSubstringFilterFn({
    getLabel: getOptionLabelFn,
    additionalKeys: Array.isArray(searchKeys) && searchKeys.length > 0 ? searchKeys : [],
    minCharsToSearch,
    maxResults,
    inputForFiltering,
  });
  const effectiveFilterOptions = useMemo(
    () => (hasCustomFilter ? filterOptionsProp : defaultFilterOptions),
    [hasCustomFilter, filterOptionsProp, defaultFilterOptions]
  );

  // Compute sorted options if requested
  const optionsForDisplay = useMemo(() => {
    if (!Array.isArray(options)) return [];
    let comparator = null;
    if (showSortToggle) {
      if (internalSortMode === 'name-asc' || internalSortMode === 'name-desc') {
        comparator = createLabelComparator(
          getOptionLabelFn,
          internalSortMode === 'name-asc' ? 'asc' : 'desc'
        );
      }
    } else {
      const isCustomSortComparator = typeof sortComparator === 'function';
      const defaultSortComparator = createLabelComparator(
        getOptionLabelFn,
        sortDirection === 'desc' ? 'desc' : 'asc'
      );
      comparator = isCustomSortComparator ? sortComparator : sortByLabel ? defaultSortComparator : null;
    }
    return comparator ? [...options].sort(comparator) : options;
  }, [
    options,
    sortComparator,
    sortByLabel,
    sortDirection,
    getOptionLabelFn,
    showSortToggle,
    internalSortMode,
  ]);

  const defaultRenderOption = (props, option, state) => {
    const labelText = String(getOptionLabelFn(option) ?? '');
    const searchTerm = getSearchTerm(inputForFiltering);
    const content =
      highlightMatches && inputForFiltering && searchTerm.length > 0
        ? SmartAutocomplete.renderHighlightedText(labelText, inputForFiltering, highlightStyle)
        : labelText;

    // Enforce single-line rendering to keep row height consistent for virtualization
    const textStyle = {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'inline-block',
      maxWidth: '100%',
    };

    const { key, ...liProps } = props || {};
    if (!multiple || !showCheckbox) {
      return (
        <li
          key={key}
          {...liProps}
        >
          <span style={textStyle}>{content}</span>
        </li>
      );
    }
    return (
      <li
        key={key}
        {...liProps}
      >
        <Checkbox
          icon={icon}
          checkedIcon={checkedIcon}
          style={{ marginRight: 8 }}
          checked={state.selected}
        />
        <span style={textStyle}>{content}</span>
      </li>
    );
  };

  const wrappedRenderOption = (props, option, state) => {
    if (renderOptionProp) {
      // Inject inputValue for consumers that want to highlight
      return renderOptionProp(props, option, { ...state, inputValue: inputForFiltering });
    }
    return defaultRenderOption(props, option, state);
  };

  const currentIcon = (() => {
    if (sortToggleIcons && sortToggleIcons[internalSortMode]) return sortToggleIcons[internalSortMode];
    if (internalSortMode === 'default') return <FaHistory size={16} />;
    if (internalSortMode === 'name-desc') return <FaSortAlphaUpAlt size={16} />; // Z→A
    return <FaSortAlphaDown size={16} />; // A→Z
  })();

  // Memoized adaptive Listbox component (virtualizes when needed)
  const VirtualizedListboxComponent = useMemo(
    () =>
      // Disable virtualization when grouping is active to ensure perfect alignment
      createAdaptiveListboxComponent({
        virtualize: groupBy ? false : virtualize,
        virtualizeIfOver: groupBy ? undefined : virtualizeIfOver,
        virtualizeOnInput: groupBy ? false : virtualizeOnInput,
        virtualizeMinInputLength,
        inputForFiltering,
        rowHeight,
        maxVisibleRows,
        overScanCount,
        debugVirtualization,
      }),
    [
      groupBy,
      virtualize,
      virtualizeIfOver,
      virtualizeOnInput,
      virtualizeMinInputLength,
      inputForFiltering,
      rowHeight,
      maxVisibleRows,
      overScanCount,
      debugVirtualization,
    ]
  );

  const cycleMode = () => {
    const next =
      internalSortMode === 'default' ? 'name-asc' : internalSortMode === 'name-asc' ? 'name-desc' : 'default';
    setInternalSortMode(next);
    onSortModeChange && onSortModeChange(next);
  };

  const belowMinChars = useMemo(
    () => minCharsToSearch > 0 && inputForFiltering.trim().length < minCharsToSearch,
    [minCharsToSearch, inputForFiltering]
  );
  const effectiveNoOptionsText = loading
    ? 'Loading...'
    : belowMinChars
    ? `Type at least ${minCharsToSearch} character${minCharsToSearch > 1 ? 's' : ''} to search`
    : noOptionsText;

  // When grouping, disable sticky headers to avoid stacking and visual glitches
  const mergedListboxProps = useMemo(() => {
    if (!groupBy) return ListboxProps;
    const groupSx = {
      '& .MuiAutocomplete-groupLabel': { position: 'static', top: 'auto', background: 'transparent' },
      '& .MuiAutocomplete-groupUl': { paddingTop: 0 },
    };
    const baseSx = (ListboxProps && ListboxProps.sx) || {};
    return { ...ListboxProps, sx: { ...baseSx, ...groupSx } };
  }, [groupBy, ListboxProps]);

  // Compose with any user-supplied onClose so we can clear input when menu closes
  const composedAutocompleteProps = useMemo(() => {
    const userOnClose = autocompleteProps?.onClose;
    const userOnOpen = autocompleteProps?.onOpen;
    return {
      ...autocompleteProps,
      onClose: (event, reason) => {
        // Keep selected item text visible when closed (single select). For multi, input stays empty.
        if (!multiple && value && value.text != null) {
          setInputValue(String(value.text));
        } else {
          setInputValue('');
        }
        // Ensure next open shows full list
        setFilterTerm('');
        if (typeof userOnClose === 'function') userOnClose(event, reason);
      },
      onOpen: (event) => {
        // Show current selection in the input and select it
        const label = !multiple && value && value.text != null ? String(value.text) : '';
        setInputValue(label);
        setFilterTerm(''); // full list until user types
        // Select all text so typing replaces it
        setTimeout(() => {
          try {
            const el = inputElRef.current;
            if (el && typeof el.select === 'function') {
              el.select();
            }
          } catch {
            /* empty */
          }
        }, 0);
        if (typeof userOnOpen === 'function') userOnOpen(event);
      },
    };
  }, [autocompleteProps, multiple, value]);

  return (
    <Autocomplete
      options={optionsForDisplay}
      value={value}
      multiple={multiple}
      loading={loading}
      disabled={loading} // Disable selection when loading
      disableClearable={disableClearable}
      filterOptions={effectiveFilterOptions}
      isOptionEqualToValue={isOptionEqualFn}
      getOptionLabel={getOptionLabelFn}
      renderOption={wrappedRenderOption}
      ListboxComponent={VirtualizedListboxComponent}
      groupBy={groupBy}
      inputValue={inputValue}
      onInputChange={(_e, v) => {
        setInputValue(v);
        setFilterTerm(v);
      }}
      noOptionsText={effectiveNoOptionsText}
      ListboxProps={mergedListboxProps}
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
                    <IconButton
                      size='small'
                      onClick={cycleMode}
                      edge='end'
                      tabIndex={-1}
                    >
                      {currentIcon}
                    </IconButton>
                  </Tooltip>
                )}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          inputRef={(node) => {
            // chain MUI's ref
            try {
              const r = params.inputProps?.ref;
              if (typeof r === 'function') r(node);
              else if (r && typeof r === 'object') r.current = node;
            } catch {
              /* empty */
            }
            inputElRef.current = node;
          }}
          {...textFieldProps}
        />
      )}
      onChange={onChange}
      {...composedAutocompleteProps}
    />
  );
}

// Static helper method for consistent highlighting in custom renderOption implementations
SmartAutocomplete.renderHighlightedText = (
  text,
  inputValue,
  highlightStyle = { backgroundColor: 'rgba(255, 235, 59, 0.35)' }
) => {
  const raw = String(text ?? '');
  const term = String(inputValue || '').trim();
  if (!term) return raw;

  const lowerRaw = raw.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts = [];
  let startIndex = 0;
  let matchIndex = lowerRaw.indexOf(lowerTerm, startIndex);

  // Highlight ALL occurrences, case-insensitive
  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(raw.substring(startIndex, matchIndex));
    }
    const matchText = raw.substring(matchIndex, matchIndex + term.length);
    parts.push(
      <span
        key={`hl-${matchIndex}`}
        style={highlightStyle}
      >
        {matchText}
      </span>
    );
    startIndex = matchIndex + term.length;
    matchIndex = lowerRaw.indexOf(lowerTerm, startIndex);
  }
  if (startIndex < raw.length) {
    parts.push(raw.substring(startIndex));
  }
  return <>{parts}</>;
};
