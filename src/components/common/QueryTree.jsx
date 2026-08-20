import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TreeSelect } from 'antd';
import { Alert } from '@mui/material';
import { toast } from 'react-toastify';
import { validateQuery } from '../../utils/queryValidation';
import { resolveSelectedQueryValue } from './queryTreeUtils';

const QUERY_TYPE_LABELS = {
  'req-test': 'Requirement - Test case',
  'test-req': 'Test case - Requirement',
  'system-requirements': 'System Requirements',
  'software-requirements': 'Software Requirements',
  'system-to-software': 'System → Software (Direct Links)',
  'software-to-system': 'Software → System (Direct Links)',
  'subsystem-to-system': 'Sub-System → System (Direct Links)',
  'system-to-subsystem': 'System → Sub-System (Direct Links)',
  'customer-requirements': 'Customer/System Requirements',
  'system-overview': 'System Overview',
  'known-bugs': 'Possible Known Bugs Queries',
  'openPcr-test': 'Open PCR to Test Case',
  'test-OpenPcr': 'Test Case to Open PCR',
  'test-associated': 'Linked Work Items',
  'linked-mom': 'Linked MOM',
};

const QueryTree = ({
  data,
  prevSelectedQuery,
  onSelectedQuery,
  queryType,
  isLoading,
  queryLabel = '',
  width = 300,
}) => {
  const toSelectedValue = useCallback((query) => resolveSelectedQueryValue(query), []);

  const [selectedQueryValue, setSelectedQueryValue] = useState(() => toSelectedValue(prevSelectedQuery));
  const [showQueryNotSelectedAlert, setShowQueryNotSelectedAlert] = useState(false);

  // Prefer an explicit label from the caller (SectionCard already carries the
  // full identity); fall back to the per-type dictionary for legacy callers.
  const title = useMemo(() => {
    const trimmed = String(queryLabel || '').trim();
    if (trimmed) return trimmed;
    return QUERY_TYPE_LABELS[queryType] || 'query';
  }, [queryLabel, queryType]);

  const hasData = Array.isArray(data) && data.length > 0;
  const status = isLoading ? 'loading' : hasData ? 'ready' : 'empty';

  const placeholder = useMemo(() => {
    switch (status) {
      case 'loading':
        return 'Loading queries…';
      case 'empty':
        return 'No queries available';
      default:
        return 'Select a query';
    }
  }, [status]);

  // Guard against re-firing the "previous query not found" toast for the same
  // invalid query id across re-renders / parent identity changes.
  const lastWarnedIdRef = useRef(null);

  useEffect(() => {
    // Skip side effects while the tree is still loading — otherwise the caller
    // can briefly see data=[] during docType switches and receive a false
    // "not found" warning.
    if (isLoading) return;
    if (!prevSelectedQuery) {
      lastWarnedIdRef.current = null;
      return;
    }
    if (!hasData) return;

    const validQuery = validateQuery(data, prevSelectedQuery);
    if (validQuery) {
      setSelectedQueryValue(toSelectedValue(validQuery));
      setShowQueryNotSelectedAlert(false);
      lastWarnedIdRef.current = null;
      return;
    }

    const warnKey = prevSelectedQuery?.id ?? prevSelectedQuery?.value ?? prevSelectedQuery?.key ?? null;
    if (warnKey !== lastWarnedIdRef.current) {
      lastWarnedIdRef.current = warnKey;
      toast.warn(
        `Previously selected query ${prevSelectedQuery?.title ?? '(unknown title)'} with ID ${
          prevSelectedQuery?.id ?? '(unknown id)'
        } not found in available queries`,
      );
    }
    setSelectedQueryValue(undefined);
    onSelectedQuery(null);
    if (typeof prevSelectedQuery === 'object' && (prevSelectedQuery.id || prevSelectedQuery.value)) {
      setShowQueryNotSelectedAlert(true);
    }
  }, [data, hasData, isLoading, prevSelectedQuery, onSelectedQuery, toSelectedValue]);

  const handleQuerySelect = (value, selectedQuery) => {
    if (selectedQuery.isValidQuery) {
      setSelectedQueryValue(value);
      onSelectedQuery(selectedQuery);
      setShowQueryNotSelectedAlert(false);
    } else {
      setSelectedQueryValue(undefined);
      onSelectedQuery(null);
      setShowQueryNotSelectedAlert(true);
    }
  };

  const handleOnClear = () => {
    setSelectedQueryValue(undefined);
    setShowQueryNotSelectedAlert(false);
    onSelectedQuery(null);
  };

  return (
    <div>
      {showQueryNotSelectedAlert && (
        <Alert
          sx={{ width, my: 1 }}
          severity='warning'
          role='status'
        >
          The previously selected query is no longer available. Please pick another.
        </Alert>
      )}
      <TreeSelect
        showSearch
        allowClear
        aria-label={title}
        loading={status === 'loading'}
        disabled={status !== 'ready'}
        treeData={hasData ? data : []}
        value={selectedQueryValue}
        placeholder={placeholder}
        onSelect={handleQuerySelect}
        onClear={handleOnClear}
        notFoundContent={status === 'empty' ? 'No queries available' : undefined}
        style={{ marginBlock: 8, width }}
        dropdownStyle={{
          maxHeight: 400,
          overflow: 'auto',
          zIndex: 1500, // Higher z-index than the drawer
        }}
      />
    </div>
  );
};

export default QueryTree;
