import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import SmartAutocomplete from './SmartAutocomplete';
import { observer } from 'mobx-react';

// Icons handled internally by SmartAutocomplete when showCheckbox=true

const PullRequestSelector = observer(
  ({
    store,
    contentControlTitle,
    skin,
    repoList,
    pullRequests,
    editingMode,
    addToDocumentRequestObject,
    contentControlIndex,
    queriesRequest,
    dataToRead,
    linkedWiOptions,
    includeCommittedBy,
    includeUnlinkedCommits,
  }) => {
    const [selectedRepo, setSelectedRepo] = useState({
      key: '',
      text: '',
    });
    const [selectedPullRequests, setSelectedPullRequests] = useState([]);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [selectedRepo, selectedPullRequests]);

    function UpdateDocumentRequestObject() {
      let pullrequestIdList = undefined;
      pullrequestIdList = selectedPullRequests.map((data) => {
        return data.pullRequestId;
      });
      addToDocumentRequestObject(
        {
          type: 'pr-change-description-table',
          title: contentControlTitle,
          skin: skin,
          headingLevel: contentHeadingLevel,
          data: {
            repoId: selectedRepo.key,
            prIds: pullrequestIdList,
            linkTypeFilterArray: null,
            systemOverviewQuery: queriesRequest,
            attachmentWikiUrl: store.attachmentWikiUrl,
            linkedWiOptions: linkedWiOptions,
            includeCommittedBy: includeCommittedBy,
            includeUnlinkedCommits: includeUnlinkedCommits,
          },
        },
        contentControlIndex
      );
    }

    const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

    return (
      <div>
        <SmartAutocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={headingLevelOptions}
          label='Select an Heading level'
          onChange={async (event, newValue) => {
            setContentHeadingLevel(newValue.key);
          }}
        />
        <SmartAutocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={repoList.map((repo) => {
            return { key: repo.id, text: repo.name };
          })}
          label='Select a Repo'
          onChange={async (event, newValue) => {
            store.fetchRepoPullRequests(newValue.key);
            setSelectedRepo(newValue);
          }}
        />

        {selectedRepo.key !== '' ? (
          <SmartAutocomplete
            style={{ marginBlock: 8, width: 300 }}
            multiple
            options={pullRequests}
            disableCloseOnSelect
            autoHighlight
            showCheckbox
            getOptionLabel={(option) => `${option.title} - (${option.pullRequestId})`}
            isOptionEqualToValue={(option, value) => option?.pullRequestId === value?.pullRequestId}
            label='selected pull requests'
            onChange={async (event, newValue) => {
              setSelectedPullRequests(newValue);
            }}
          />
        ) : null}

        <br />
        <br />
        {editingMode ? (
          <PrimaryButton
            text='Add Content To Document'
            onClick={() => {
              UpdateDocumentRequestObject();
            }}
          />
        ) : null}
      </div>
    );
  }
);

export default PullRequestSelector;
