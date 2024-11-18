import React, { useEffect, useState } from 'react';
import { TreeSelect } from 'antd';
import { Alert } from '@mui/material';

const QueryTree = ({ data, onSelectedQuery, queryType, isLoading }) => {
  const [selectedQuery, setSelectedQuery] = useState(undefined);

  const [showQueryNotSelectedAlert, setShowQueryNotSelectedAlert] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [placeholder, setPlaceholder] = useState(noData);
  const noData = `No query for ${
    queryType === 'req-test' ? 'Requirement - Test case' : 'Test case - Requirement'
  } available`;
  useEffect(() => {
    setIsDisabled(data?.length === 0);
  }, [data]);

  useEffect(() => {
    !isDisabled
      ? setPlaceholder(
          `Select a ${queryType === 'req-test' ? 'Requirement - Test case' : 'Test case - Requirement'} query`
        )
      : setPlaceholder(noData);
  }, [isDisabled]);

  const handleQuerySelect = (value, selectedNode) => {
    if (selectedNode.isValidQuery) {
      setSelectedQuery(value);
      onSelectedQuery((val) =>
        queryType === 'req-test'
          ? { ...val, reqTestQuery: selectedNode }
          : { ...val, testReqQuery: selectedNode }
      );
      setShowQueryNotSelectedAlert(false);
    } else {
      setSelectedQuery(undefined);
      onSelectedQuery((val) =>
        queryType === 'req-test' ? { ...val, reqTestQuery: null } : { ...val, testReqQuery: null }
      );
      setShowQueryNotSelectedAlert(true);
    }
    // Perform actions with selected node IDs
  };

  const handleOnClear = () => {
    setSelectedQuery(undefined);
    onSelectedQuery((val) =>
      queryType === 'req-test' ? { ...val, reqTestQuery: null } : { ...val, testReqQuery: null }
    );
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
          style={{ width: '100%', marginTop: 5 }}
          dropdownStyle={{
            maxHeight: 400,
            overflow: 'auto',
          }}
          treeData={data}
          disabled={isDisabled}
          value={selectedQuery}
          treeDefaultExpandAll
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
