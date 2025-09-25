import React, { useCallback, useEffect, useState } from 'react';
import { TreeSelect } from 'antd';
import { Alert } from '@mui/material';
import { toast } from 'react-toastify';
import { validateQuery } from '../../utils/queryValidation';

const QueryTree = ({ data, prevSelectedQuery, onSelectedQuery, queryType, isLoading }) => {
  const [selectedQuery, setSelectedQuery] = useState(prevSelectedQuery);
  const [showQueryNotSelectedAlert, setShowQueryNotSelectedAlert] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [placeholder, setPlaceholder] = useState('');

  // Title and no-data message helpers must be declared before effects that depend on them
  const getTitle = useCallback(() => {
    switch (queryType) {
      case 'req-test':
        return 'Requirement - Test case';
      case 'test-req':
        return 'Test case - Requirement';
      case 'system-requirements':
        return 'System Requirements';
      case 'system-to-software':
        return 'System -> Software (Direct Links)';
      case 'software-to-system':
        return 'Software -> System (Direct Links)';
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
  }, [queryType]);

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
        setSelectedQuery(prevSelectedQuery);
        setShowQueryNotSelectedAlert(false);
      } else {
        // Query doesn't exist or is invalid in the current context
        toast.warn(
          `Previously selected query ${prevSelectedQuery?.title ?? '(unknown title)'} with ID ${
            prevSelectedQuery?.id ?? '(unknown id)'
          } not found in available queries`
        );
        setSelectedQuery(undefined);
        onSelectedQuery(null);

        if (prevSelectedQuery.id) {
          // Show an alert that the previously selected query is no longer available
          setShowQueryNotSelectedAlert(true);
        }
      }
    }
  }, [data, prevSelectedQuery, onSelectedQuery]);

  

  const handleQuerySelect = (value, selectedQuery) => {
    if (selectedQuery.isValidQuery) {
      setSelectedQuery(value);

      onSelectedQuery(selectedQuery);
      setShowQueryNotSelectedAlert(false);
    } else {
      setSelectedQuery(undefined);

      onSelectedQuery(null);
      setShowQueryNotSelectedAlert(true);
    }
    // Perform actions with selected node IDs
  };

  const handleOnClear = () => {
    setSelectedQuery(undefined);
    onSelectedQuery(null);
  };

  return (
    <div>
      {showQueryNotSelectedAlert && (
        <Alert
          sx={{ width: 300, my: 1 }}
          severity='info'
        >
          Please select a valid query:
        </Alert>
      )}
      {data?.length > 0 && (
        <TreeSelect
          showSearch
          onClear={handleOnClear}
          style={{ marginBlock: 8, width: 300 }}
          dropdownStyle={{
            maxHeight: 400,
            overflow: 'auto',
            zIndex: 1500, // Higher z-index than the drawer
          }}
          treeData={data}
          disabled={isDisabled}
          value={selectedQuery}
          placeholder={placeholder}
          onSelect={handleQuerySelect}
          allowClear
          loading={isLoading}
        />
      )}
    </div>
  );
};

export default QueryTree;
