import { Select, MenuItem } from '@mui/material';
import React from 'react';

const LinkTypeSelector = ({ store, linkTypes, updateSelectedLinksFilter }) => {
  return (
    <Select
      placeholder='Select a LinkType to filter'
      multiSelect
      label='Select an LinkType'
      value={linkTypes}
      onChange={(event, newValue) => {
        updateSelectedLinksFilter(newValue);
      }}
    >
      {store.linkTypes.map((linkType, index) => (
        <MenuItem
          key={index}
          value={linkType.key}
        >
          {linkType.text}
        </MenuItem>
      ))}
    </Select>
  );
};

export default LinkTypeSelector;
