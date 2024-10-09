import React, { useState } from 'react';

import { Dropdown } from '@fluentui/react/lib/Dropdown';

import TestContentSelector from './TestContentSelector';
import QueryContentSelector from './QueryContentSelector';
import LinkTypeSelector from './LinkTypeSelector';

const dropdownStyles = {
  dropdown: { width: 300 },
};
const baseDataType = [
  { key: 0, text: 'test-plan based', type: 'test' },
  { key: 1, text: 'query based', type: 'query' },
];

const TraceTableSelector = ({
  store,
  contentControlTitle,
  contentControlArrayCell,
  editingMode,
  addToDocumentRequestObject,
}) => {
  const [selectedType, setselectedType] = useState('query');

  return (
    <div>
      <Dropdown
        placeholder='Select Base Data Type'
        label='Select Base Data Type'
        options={baseDataType}
        styles={dropdownStyles}
        onChange={(event, newValue) => {
          setselectedType(newValue.type);
        }}
      />
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
          fetchTestSuitesList={store.fetchTestSuitesList}
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
