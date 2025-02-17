import React, { useEffect, useState } from 'react';
import { TreeSelect } from 'antd';
import { Alert } from '@mui/material';

const QueryTree = ({ data, prevSelectedQuery, onSelectedQuery, queryType, isLoading }) => {
  const [selectedQuery, setSelectedQuery] = useState(prevSelectedQuery);
  const [showQueryNotSelectedAlert, setShowQueryNotSelectedAlert] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [placeholder, setPlaceholder] = useState(noData);

  useEffect(() => {
    setIsDisabled(data?.length === 0);
  }, [data]);

  const getTitle = () => {
    switch (queryType) {
      case 'req-test':
        return 'Requirement - Test case';
      case 'test-req':
        return 'Test case - Requirement';
      case 'system-overview':
        return 'System Overview';
      case 'known-bugs':
        return 'Possible Known Bugs Queries';
      default:
        return 'Default';
    }
  };

  const noData = `No query for ${getTitle()} available`;

  useEffect(() => {
    !isDisabled ? setPlaceholder(`Select a ${getTitle()} query`) : setPlaceholder(noData);
  }, [isDisabled]);

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
