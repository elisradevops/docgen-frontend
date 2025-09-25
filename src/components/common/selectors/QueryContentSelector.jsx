import React, { useState } from 'react';
import { headingLevelOptions } from '../../../store/data/dropDownOptions';
import { Button, Select, MenuItem } from '@mui/material';
import SmartAutocomplete from '../SmartAutocomplete';

const dropdownStyles = {
  dropdown: { width: 300 },
};

const QueryContentSelector = ({
  contentControlTitle,
  type,
  skin,
  sharedQueriesList,
  editingMode,
  addToDocumentRequestObject,
  linkTypeFilterArray = null,
}) => {
  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);
  const [selectedSharedQuery, setSelectedSharedQuery] = useState({
    key: '',
    text: '',
  });
  return (
    <div>
      <SmartAutocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={headingLevelOptions}
        label='Select an Heading level'
        onChange={async (_e, newValue) => {
          setContentHeadingLevel(newValue.key);
        }}
      />
      <Select
        placeholder='Select a Query'
        label='Select a Query'
        value={selectedSharedQuery.id}
        styles={dropdownStyles}
        onChange={(event, newValue) => {
          setSelectedSharedQuery(newValue.id.toString());
        }}
      >
        {sharedQueriesList.map((query) => (
          <MenuItem
            key={query.id}
            value={query.id}
          >
            {query.queryName}
          </MenuItem>
        ))}
      </Select>
      <br />
      <br />
      {/* works only in document managing mode */}
      {editingMode ? (
        <Button
          variant='contained'
          onClick={() => {
            addToDocumentRequestObject(
              {
                title: contentControlTitle,
                skin: skin,
                headingLevel: contentHeadingLevel,
                data: {
                  type: type,
                  queryId: selectedSharedQuery,
                },
              },
              null,
              linkTypeFilterArray
            );
          }}
        >
          Add Content To Document
        </Button>
      ) : null}
    </div>
  );
};
export default QueryContentSelector;
