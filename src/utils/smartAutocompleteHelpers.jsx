/**
 * SmartAutocomplete helpers
 * Small, focused utility functions used by the SmartAutocomplete component.
 */

import React from 'react';
import { Virtuoso } from 'react-virtuoso';

// Safe getter for nested keys like 'a.b.c'. Returns an empty string when a path is missing.
export function getByPath(obj, path) {
  if (!obj || !path) return '';
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return '';
    cur = cur[p];
  }
  return cur ?? '';
}

// Normalize user input to a single lowercased term for substring match
export function getSearchTerm(input) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().toLowerCase();
}

// Build a single searchable string from the visible label + optional extra fields
export function buildSearchableText(option, getLabel, additionalKeys) {
  const label = String(getLabel(option) ?? '');
  const extras = (additionalKeys || []).map((k) => String(getByPath(option, k))).filter(Boolean);
  return [label, ...extras].join(' ').toLowerCase().trim();
}

// Factory: returns a MUI-compatible filterOptions function that uses a unified input value
export function createSubstringFilterFn({
  getLabel,
  additionalKeys,
  minCharsToSearch,
  maxResults,
  inputForFiltering,
}) {
  return (options) => {
    const raw = String(inputForFiltering || '');
    const trimmed = raw.trim();
    if (minCharsToSearch > 0 && trimmed.length < minCharsToSearch) return [];
    const term = trimmed.toLowerCase();
    if (!term) return options;

    const filtered = options.filter((option) =>
      buildSearchableText(option, getLabel, additionalKeys).includes(term)
    );
    const limit = typeof maxResults === 'number' && maxResults > 0 ? maxResults : undefined;
    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
  };
}

// Create a locale-aware comparator by label (asc or desc)
export function createLabelComparator(getLabel, direction /* 'asc' | 'desc' */ = 'asc') {
  const base = (a, b) =>
    String(getLabel(a) ?? '').localeCompare(String(getLabel(b) ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  return direction === 'desc' ? (a, b) => -base(a, b) : base;
}

// Create an adaptive (virtualized) Listbox component or return undefined to use MUI default
export function createAdaptiveListboxComponent({
  virtualize,
  virtualizeIfOver,
  virtualizeOnInput,
  virtualizeMinInputLength,
  inputForFiltering,
  rowHeight,
  maxVisibleRows,
  overscanCount,
  debugVirtualization = false,
}) {
  if (!virtualize && typeof virtualizeIfOver !== 'number' && !virtualizeOnInput) return undefined;

  const AdaptiveListbox = React.forwardRef(function ListboxComponent(props, ref) {
    const { children, ...other } = props;
    const itemData = React.Children.toArray(children);
    const itemCount = itemData.length;
    const threshold = typeof virtualizeIfOver === 'number' ? virtualizeIfOver : Number.POSITIVE_INFINITY;
    const typingLen = typeof inputForFiltering === 'string' ? inputForFiltering.trim().length : 0;
    const enableOnTyping = !!virtualizeOnInput && typingLen >= virtualizeMinInputLength;
    const bigEnough = itemCount > maxVisibleRows + 2;
    const enable = bigEnough && (!!virtualize || itemCount >= threshold || enableOnTyping);
    if (debugVirtualization) {
      // Helpful trace when toggling virtualization during filtering
      // eslint-disable-next-line no-console
      console.debug('[SmartAutocomplete] virtualization', {
        itemCount,
        bigEnough,
        virtualize,
        threshold,
        enableOnTyping,
        inputLen: typingLen,
        enable,
      });
    }

    if (!enable) {
      return (
        <ul
          ref={ref}
          {...other}
        >
          {children}
        </ul>
      );
    }

    const height = Math.min(maxVisibleRows, itemCount) * rowHeight;
    return (
      <div ref={ref}>
        <Virtuoso
          style={{ height, width: '100%' }}
          data={itemData}
          overscan={overscanCount}
          // Render only the contents of each existing <li>, while Virtuoso provides the <li> wrapper.
          itemContent={(index) => {
            const el = itemData[index];
            return React.isValidElement(el) ? el.props.children : el;
          }}
          components={{
            List: React.forwardRef(function ListComponent(listProps, listRef) {
              // Bridge the outer Autocomplete listbox props + ref to the actual <ul>
              const setRef = (node) => {
                if (typeof listRef === 'function') listRef(node);
                else if (listRef) listRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
              };
              return (
                <ul
                  ref={setRef}
                  {...other}
                  {...listProps}
                />
              );
            }),
            Item: React.forwardRef(function ItemComponent(itemProps, itemRef) {
              return (
                <li
                  ref={itemRef}
                  {...itemProps}
                />
              );
            }),
          }}
        />
      </div>
    );
  });

  return AdaptiveListbox;
}
