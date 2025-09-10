import React, { useState, useEffect, useCallback } from 'react';
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

    const [contentHeadingLevel, setContentHeadingLevel] = useState(1);

    const UpdateDocumentRequestObject = useCallback(() => {
      // selectedPullRequests now stores simplified items: { key, text }
      const pullrequestIdList = Array.isArray(selectedPullRequests)
        ? selectedPullRequests.map((item) => item.key)
        : [];
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
    }, [
      selectedPullRequests,
      addToDocumentRequestObject,
      contentControlTitle,
      skin,
      contentHeadingLevel,
      selectedRepo,
      queriesRequest,
      store.attachmentWikiUrl,
      linkedWiOptions,
      includeCommittedBy,
      includeUnlinkedCommits,
      contentControlIndex,
    ]);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [selectedRepo, selectedPullRequests, UpdateDocumentRequestObject, editingMode]);

    // Validation: repo and at least one PR must be selected
    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!selectedRepo?.key) {
        isValid = false;
        message = 'Select a repository';
      } else if (!Array.isArray(selectedPullRequests) || selectedPullRequests.length === 0) {
        isValid = false;
        message = 'Select at least one pull request';
      }
      try {
        store.setValidationState(contentControlIndex, 'pullrequest', { isValid, message });
      } catch {}
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'pullrequest');
        } catch {}
      };
    }, [selectedRepo?.key, selectedPullRequests, store, contentControlIndex]);

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
          options={repoList.map((repo) => ({ key: repo.id, text: repo.name }))}
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
            options={pullRequests.map((pr) => ({ key: pr.pullRequestId, text: `${pr.title} - (${pr.pullRequestId})` }))}
            disableCloseOnSelect
            autoHighlight
            showCheckbox
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
