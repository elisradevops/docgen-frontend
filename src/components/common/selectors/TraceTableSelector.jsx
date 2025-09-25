import React, { useState } from 'react';

import TestContentSelector from '../table/TestContentSelector';
import QueryContentSelector from '../selectors/QueryContentSelector';
import LinkTypeSelector from '../selectors/LinkTypeSelector';
import { MenuItem, Select } from '@mui/material';

const baseDataType = [
  { key: 0, text: 'test-plan based', type: 'test' },
  { key: 1, text: 'query based', type: 'query' },
];

const TraceTableSelector = ({ store, contentControlTitle, editingMode, addToDocumentRequestObject }) => {
  const [selectedType, setSelectedType] = useState('query');

  return (
    <div>
      <Select
        label='Select Base Data Type'
        sx={{ width: 300 }}
        value={selectedType}
        onChange={(event, newValue) => {
          setSelectedType(newValue.type);
        }}
      >
        {baseDataType.map((option) => (
          <MenuItem
            key={option.key}
            value={option.type}
          >
            {option.text}
          </MenuItem>
        ))}
      </Select>
      <LinkTypeSelector
        store={store}
        linkTypeFilter={store.linkTypes}
        updateSelectedLinksFilter={store.updateSelectedLinksFilter}
      />
      {selectedType === 'test' ? (
        <TestContentSelector
          store={store}
          contentControlTitle={contentControlTitle}
          type={selectedType}
          skin='trace-table'
          testPlansList={store.testPlansList}
          testSuiteList={store.testSuiteList}
          contentControlArrayCell={null}
          editingMode={editingMode}
          addToDocumentRequestObject={addToDocumentRequestObject}
          linkTypeFilterArray={store.linkTypesFilter}
        />
      ) : null}
      {selectedType === 'query' ? (
        <QueryContentSelector
          contentControlTitle={contentControlTitle}
          teamProjectName={store.teamProject}
          type={selectedType}
          skin='trace-table'
          sharedQueriesList={store.sharedQueries}
          contentControlArrayCell={null}
          editingMode={editingMode}
          addToDocumentRequestObject={addToDocumentRequestObject}
          linkTypeFilterArray={store.linkTypesFilter}
        />
      ) : null}
      <br />
      <br />
    </div>
  );
};

export default TraceTableSelector;
