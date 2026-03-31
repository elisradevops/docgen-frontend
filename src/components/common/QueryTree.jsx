import React, { useCallback, useEffect, useState } from 'react';
import { TreeSelect } from 'antd';
import { Alert, TextField } from '@mui/material';
import { toast } from 'react-toastify';
import { validateQuery } from '../../utils/queryValidation';
import { resolveSelectedQueryValue } from './queryTreeUtils';

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
  const [isDisabled, setIsDisabled] = useState(false);
  const [placeholder, setPlaceholder] = useState('');

  // Title and no-data message helpers must be declared before effects that depend on them
  const getTitle = useCallback(() => {
    if (String(queryLabel || '').trim()) {
      return String(queryLabel).trim();
    }
    switch (queryType) {
      case 'req-test':
        return 'Requirement - Test case';
      case 'test-req':
        return 'Test case - Requirement';
      case 'system-requirements':
        return 'System Requirements';
      case 'software-requirements':
        return 'Software Requirements';
      case 'system-to-software':
        return 'System -> Software (Direct Links)';
      case 'software-to-system':
        return 'Software -> System (Direct Links)';
      case 'subsystem-to-system':
        return 'Sub-System -> System (Direct Links)';
      case 'system-to-subsystem':
        return 'System -> Sub-System (Direct Links)';
      case 'system-overview':
        return 'System Overview';
      case 'known-bugs':
        return 'Possible Known Bugs Queries';
      case 'openPcr-test':
        return 'Open PCR to Test Case';
      case 'test-OpenPcr':
        return 'Test Case to Open PCR';
      case 'test-associated':
        return 'Linked Work Items';
      case 'linked-mom':
        return 'Linked MOM';
      default:
        return 'Default';
    }
  }, [queryLabel, queryType]);

  const noData = `No query for ${getTitle()} available`;

  useEffect(() => {
    const disabled = data?.length === 0;
    setIsDisabled(disabled);
    setPlaceholder(disabled ? noData : `Select a ${getTitle()} query`);
  }, [data, getTitle, noData]);

  //Reading the loaded selected favorite data
  useEffect(() => {
    // Only attempt to validate if we have both a previous query and data
    if (data?.length > 0 && prevSelectedQuery) {
      const validQuery = validateQuery(data, prevSelectedQuery);

      if (validQuery) {
        // Query exists and is valid, so set it
        setSelectedQueryValue(toSelectedValue(validQuery));
        setShowQueryNotSelectedAlert(false);
      } else {
        // Query doesn't exist or is invalid in the current context
        toast.warn(
          `Previously selected query ${prevSelectedQuery?.title ?? '(unknown title)'} with ID ${
            prevSelectedQuery?.id ?? '(unknown id)'
          } not found in available queries`
        );
        setSelectedQueryValue(undefined);
        onSelectedQuery(null);

        if (typeof prevSelectedQuery === 'object' && (prevSelectedQuery.id || prevSelectedQuery.value)) {
          // Show an alert that the previously selected query is no longer available
          setShowQueryNotSelectedAlert(true);
        }
      }
    }
  }, [data, prevSelectedQuery, onSelectedQuery, toSelectedValue]);

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
    // Perform actions with selected node IDs
  };

  const handleOnClear = () => {
    setSelectedQueryValue(undefined);
    onSelectedQuery(null);
  };

  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div>
      {showQueryNotSelectedAlert && (
        <Alert sx={{ width, my: 1 }} severity='info'>
          Please select a valid query:
        </Alert>
      )}
      {hasData ? (
        <TreeSelect
          showSearch
          onClear={handleOnClear}
          style={{ marginBlock: 8, width }}
          dropdownStyle={{
            maxHeight: 400,
            overflow: 'auto',
            zIndex: 1500, // Higher z-index than the drawer
          }}
          treeData={data}
          disabled={isDisabled}
          value={selectedQueryValue}
          placeholder={placeholder}
          onSelect={handleQuerySelect}
          allowClear
          loading={isLoading}
        />
      ) : (
        // Render a disabled field so users get a clear affordance even when no data exists
        <TextField
          size='small'
          value=''
          disabled
          placeholder={placeholder}
          sx={{ width, my: 1 }}
          inputProps={{ 'aria-label': getTitle() }}
        />
      )}
    </div>
  );
};

export default QueryTree;
