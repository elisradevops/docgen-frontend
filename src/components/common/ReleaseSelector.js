import React, { useState, useEffect } from "react";
import { PrimaryButton } from "office-ui-fabric-react";
import { headingLevelOptions } from "../../store/data/dropDownOptions";
import Autocomplete from "@material-ui/lab/Autocomplete";
import TextFieldM from "@material-ui/core/TextField";

const ReleaseSelector = ({
  store,
  contentControlTitle,
  skin,
  releaseDefinitionList,
  releaseDefinitionHistory,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
}) => {
  useEffect(() => {
    if (editingMode === false) {
      UpdateDocumentRequestObject();
    }
  });

  function UpdateDocumentRequestObject() {
    addToDocumentRequestObject(
      {
        type: "change-description-table",
        title: contentControlTitle,
        skin: skin,
        headingLevel: contentHeadingLevel,
        data: {
          from: selectedReleaseHistoryStart.key,
          to: selectedReleaseHistoryEnd.key,
          rangeType: "release",
          linkTypeFilterArray: null,
        },
      },
      contentControlIndex
    );
  }

  const [SelectedReleaseDefinition, setSelectedReleaseDefinition] = useState({
    key: "",
    text: "",
  });

  const [selectedReleaseHistoryStart, setSelectedReleaseHistoryStart] =
    useState({
      key: "",
      text: "",
    });

  const [selectedReleaseHistoryEnd, setSelectedReleaseHistoryEnd] = useState({
    key: "",
    text: "",
  });

  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

  return (
    <div>
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={headingLevelOptions}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextFieldM
            {...params}
            label="Select an Heading level"
            variant="outlined"
          />
        )}
        onChange={async (event, newValue) => {
          setContentHeadingLevel(newValue.key);
        }}
      />
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={releaseDefinitionList.map((releaseDefinition) => {
          return { key: releaseDefinition.id, text: releaseDefinition.name };
        })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextFieldM {...params} label="Select a Release" variant="outlined" />
        )}
        onChange={async (event, newValue) => {
          setSelectedReleaseDefinition(newValue);
          store.fetchReleaseDefinitionHistory(newValue.key);
        }}
      />
      {SelectedReleaseDefinition.key !== "" ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={releaseDefinitionHistory.map((run) => {
            return { key: run.id, text: run.name };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextFieldM
              {...params}
              label="Select start release"
              variant="outlined"
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedReleaseHistoryStart(newValue);
          }}
        />
      ) : null}
      {SelectedReleaseDefinition.key !== "" ? (
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={releaseDefinitionHistory.map((run) => {
            return { key: run.id, text: run.name };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextFieldM
              {...params}
              label="Select end release"
              variant="outlined"
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedReleaseHistoryEnd(newValue);
          }}
        />
      ) : null}
      <br />
      <br />
      {editingMode ? (
        <PrimaryButton
          text="Add Content To Document"
          onClick={() => {
            UpdateDocumentRequestObject();
          }}
        />
      ) : null}
    </div>
  );
};

export default ReleaseSelector;
