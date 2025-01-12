import React, { useEffect, useState } from 'react';
import { TreeSelect } from 'antd';
import { Alert } from '@mui/material';

const QueryTree = ({ data, onSelectedQuery, queryType, isLoading }) => {
  const [selectedQuery, setSelectedQuery] = useState(undefined);
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
      onSelectedQuery((prev) => {
        switch (queryType) {
          case 'req-test':
            return { ...prev, reqTestQuery: selectedQuery };
          case 'test-req':
            return { ...prev, testReqQuery: selectedQuery };
          case 'system-overview':
            return { ...prev, sysOverviewQuery: selectedQuery };
          case 'known-bugs':
            return { ...prev, knownBugsQuery: selectedQuery };
          default:
            break;
        }
      });
      setShowQueryNotSelectedAlert(false);
    } else {
      setSelectedQuery(undefined);
      onSelectedQuery((prev) => {
        return ClearSelectedQuery(queryType, prev);
      });
      setShowQueryNotSelectedAlert(true);
    }
    // Perform actions with selected node IDs
  };

  const handleOnClear = () => {
    setSelectedQuery(undefined);
    onSelectedQuery((prev) => {
      return ClearSelectedQuery(queryType, prev);
    });
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
function ClearSelectedQuery(queryType, prev) {
  switch (queryType) {
    case 'req-test':
      return { ...prev, reqTestQuery: null };
    case 'test-req':
      return { ...prev, testReqQuery: null };
    case 'system-overview':
      return { ...prev, sysOverviewQuery: null };
    case 'known-bugs':
      return { ...prev, knownBugsQuery: null };
    default:
      break;
  }
}
