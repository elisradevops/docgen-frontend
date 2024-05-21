import React from "react";

import { Dropdown } from "office-ui-fabric-react/lib/Dropdown";

const dropdownStyles = {
  dropdown: { width: 300 },
};

const LinkTypeSelector = ({ store, linkTypes, updateSelectedLinksFilter }) => {
  return (
    <Dropdown
      placeholder="Select a LinkType to filter"
      multiSelect
      label="Select an LinkType"
      value={linkTypes}
      options={store.linkTypes}
      styles={dropdownStyles}
      onChange={(event, newValue) => {
        updateSelectedLinksFilter(newValue);
      }}
    />
  );
};

export default LinkTypeSelector;
