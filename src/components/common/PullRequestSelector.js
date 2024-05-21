import React, { useState, useEffect } from "react";
import { PrimaryButton } from "office-ui-fabric-react";
import { headingLevelOptions } from "../../store/data/dropDownOptions";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Checkbox from "@material-ui/core/Checkbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import CheckBoxOutlineBlankIcon from "@material-ui/icons/CheckBoxOutlineBlank";
import TextField from "@material-ui/core/TextField";

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

const PullRequestSelector = ({
  store,
  contentControlTitle,
  skin,
  repoList,
  pullRequests,
  editingMode,
  addToDocumentRequestObject,
  contentControlIndex,
}) => {
  const [selectedRepo, setSelectedRepo] = useState({
    key: "",
    text: "",
  });
  const [selectedPullRequests, setSelectedPullRequests] = useState([]);

  useEffect(() => {
    if (editingMode === false) {
      UpdateDocumentRequestObject();
    }
  });

  function UpdateDocumentRequestObject() {
    let pullrequestIdList = undefined;
    pullrequestIdList = selectedPullRequests.map((data) => {
      return data.pullRequestId;
    });
    addToDocumentRequestObject(
      {
        type: "pr-change-description-table",
        title: contentControlTitle,
        skin: skin,
        headingLevel: contentHeadingLevel,
        data: {
          repoId: selectedRepo.key,
          prIds: pullrequestIdList,
          linkTypeFilterArray: null,
        },
      },
      contentControlIndex
    );
  }

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
          <TextField
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
        options={repoList.map((repo) => {
          return { key: repo.id, text: repo.name };
        })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField {...params} label="Select a Repo" variant="outlined" />
        )}
        onChange={async (event, newValue) => {
          store.fetchRepoPullRequests(newValue.key);
          setSelectedRepo(newValue);
        }}
      />

      {selectedRepo.key !== "" ? (
        <Autocomplete
          style={{ marginBlock: 8, width: 300 }}
          multiple
          options={pullRequests}
          disableCloseOnSelect
          autoHighlight
          getOptionLabel={(option) =>
            `${option.title} - (${option.pullRequestId})`
          }
          renderOption={(option, { selected }) => (
            <React.Fragment>
              <Checkbox
                icon={icon}
                checkedIcon={checkedIcon}
                style={{ marginRight: 8 }}
                checked={selected}
              />
              {`${option.title} - (${option.pullRequestId})`}
            </React.Fragment>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="selected pull requests"
              variant="outlined"
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedPullRequests(newValue);
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

export default PullRequestSelector;
