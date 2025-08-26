import React, { useState, useEffect, useCallback } from 'react';
import { PrimaryButton } from '@fluentui/react';
import {
  Grid,
  Divider,
  Typography,
  Tooltip,
  Button,
  ButtonGroup,
  Box,
} from '@mui/material';
import SmartAutocomplete from './SmartAutocomplete';
import { observer } from 'mobx-react';
import { toast } from 'react-toastify';
const gitObjType = [
  { key: 'tag', text: 'Tags' },
  { key: 'branch', text: 'Branches' },
  { key: 'commit', text: 'Commits' },
];

const defaultGitRefState = {
  source: { gitObjType: { key: '', text: '' }, gitObjRef: { key: '', text: '' } },
  target: { gitObjType: { key: '', text: '' }, gitObjRef: { key: '', text: '' } },
};

const defaultItem = {
  key: '',
  text: '',
};

const GitObjectRangeSelector = observer(
  ({
    store,
    contentControlTitle,
    skin,
    editingMode,
    addToDocumentRequestObject,
    contentControlIndex,
    queriesRequest,
    dataToRead = undefined,
    linkedWiOptions,
    includeCommittedBy,
    includeUnlinkedCommits,
  }) => {
    const [selectedRepo, setSelectedRepo] = useState(defaultItem);

    const [gitRefState, setGitRefState] = useState(defaultGitRefState);

    const [sourceGitRefOptions, setSourceGitRefOptions] = useState([]);
    const [targetGitRefOptions, setTargetGitRefOptions] = useState([]);
    const [sourceLoading, setSourceLoading] = useState(false);
    const [targetLoading, setTargetLoading] = useState(false);

    const UpdateDocumentRequestObject = useCallback(() => {
      if (selectedRepo.text) {
        let convertedText = selectedRepo.text.replace(/\./g, '-').replace(/\s/g, '_');
        store.setContextName(`git-object-range-${convertedText}`);
      }
      addToDocumentRequestObject(
        {
          type: 'change-description-table',
          title: contentControlTitle,
          skin: skin,
          headingLevel: 1,
          data: {
            repoId: selectedRepo.key,
            from: {
              type: gitRefState.source.gitObjType.key,
              ref: gitRefState.source.gitObjRef.key,
            },
            fromText: gitRefState.source.gitObjRef.text,
            to: {
              type: gitRefState.target.gitObjType.key,
              ref: gitRefState.target.gitObjRef.key,
            },
            toText: gitRefState.target.gitObjRef.text,
            rangeType: 'range',
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
      selectedRepo.text,
      selectedRepo.key,
      addToDocumentRequestObject,
      contentControlTitle,
      skin,
      gitRefState.source.gitObjType.key,
      gitRefState.source.gitObjRef.key,
      gitRefState.source.gitObjRef.text,
      gitRefState.target.gitObjType.key,
      gitRefState.target.gitObjRef.key,
      gitRefState.target.gitObjRef.text,
      queriesRequest,
      store,
      linkedWiOptions,
      contentControlIndex,
      includeCommittedBy,
      includeUnlinkedCommits,
    ]);

    const findGitObjectType = useCallback((typeKey) => {
      return gitObjType.find((type) => type.key === typeKey) || { key: typeKey || '', text: '' };
    }, []);

    const findRepoById = useCallback((repoList, repoId) => {
      const repo = repoList.find((repo) => repo.id === repoId);
      return repo || { id: repoId, name: '' };
    }, []);

    const loadReferencesForType = useCallback(
      async (repoName, typeKey) => {
        if (!typeKey) return [];

        try {
          if (typeKey === 'commit') {
            return await store.fetchGitRepoCommits(repoName);
          } else {
            return await store.fetchGitObjectRefsByType(repoName, typeKey);
          }
        } catch (error) {
          console.error(`Error fetching ${typeKey} references:`, error);
          return [];
        }
      },
      [store]
    );

    const processReference = useCallback((options, refValue, label, defaultValue) => {
      if (!refValue) return defaultValue;

      const loadedRef = options.find((ref) => ref.value === refValue);

      if (!loadedRef) {
        toast.warn(`${label}: ${refValue} not found in the list of references.`);
        return defaultValue;
      }

      return {
        key: loadedRef.value,
        text: loadedRef.name,
      };
    }, []);

    const loadReferenceOptions = useCallback(
      async (repoObj, fromTypeObj, toTypeObj, data) => {
        try {
          // Load source references
          setSourceLoading(true);
          const sourceOptions = await loadReferencesForType(repoObj.name, fromTypeObj.key);
          setSourceGitRefOptions(sourceOptions);
          setSourceLoading(false);

          // Load target references
          setTargetLoading(true);
          const targetOptions = await loadReferencesForType(repoObj.name, toTypeObj.key);
          setTargetGitRefOptions(targetOptions);
          setTargetLoading(false);

          // Process source reference
          const fromRefObj = processReference(
            sourceOptions,
            data.from?.ref,
            `Source ${data.from?.type}`,
            defaultItem
          );

          // Process target reference
          const toRefObj = processReference(
            targetOptions,
            data.to?.ref,
            `Target ${data.to?.type}`,
            defaultItem
          );

          // Set complete state structure
          setGitRefState({
            source: { gitObjType: fromTypeObj, gitObjRef: fromRefObj },
            target: { gitObjType: toTypeObj, gitObjRef: toRefObj },
          });
        } catch (error) {
          console.error('Error loading references:', error);
          toast.error('Failed to load git references');
          setSourceLoading(false);
          setTargetLoading(false);
        }
      },
      [loadReferencesForType, processReference]
    );

    // Helpers to determine the latest tag (by semver when possible)
    const parseTagSemver = useCallback((name) => {
      if (!name) return null;
      const cleaned = String(name)
        .trim()
        .replace(/^refs\/tags\//, '')
        .replace(/^release[-\/]/i, '')
        .replace(/^v/i, '');
      const m = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/);
      if (!m) return null;
      return {
        major: Number(m[1] || 0),
        minor: Number(m[2] || 0),
        patch: Number(m[3] || 0),
        prerelease: m[4] || null,
      };
    }, []);

    const compareSemverAsc = useCallback((a, b) => {
      if (a.major !== b.major) return a.major - b.major;
      if (a.minor !== b.minor) return a.minor - b.minor;
      if (a.patch !== b.patch) return a.patch - b.patch;
      // Same version numbers: release > prerelease
      if (a.prerelease && !b.prerelease) return -1;
      if (!a.prerelease && b.prerelease) return 1;
      if (a.prerelease && b.prerelease) return a.prerelease.localeCompare(b.prerelease);
      return 0;
    }, []);

    const compareTagNamesAsc = useCallback(
      (aName, bName) => {
        const aV = parseTagSemver(aName);
        const bV = parseTagSemver(bName);
        if (aV && bV) return compareSemverAsc(aV, bV);
        // Fallback: natural numeric compare
        return String(aName).localeCompare(String(bName), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      },
      [parseTagSemver, compareSemverAsc]
    );

    // Preset handlers for Target (To)
    const presetTargetToHead = useCallback(async () => {
      if (!selectedRepo?.text) return;
      try {
        setTargetLoading(true);
        const commits = await store.fetchGitRepoCommits(selectedRepo.text);
        setTargetGitRefOptions(commits);
        const first = commits?.[0];
        if (first) {
          setGitRefState((prev) => ({
            ...prev,
            target: {
              gitObjType: findGitObjectType('commit'),
              gitObjRef: { key: first.value, text: first.name },
            },
          }));
        }
      } finally {
        setTargetLoading(false);
      }
    }, [findGitObjectType, selectedRepo?.text, store]);

    const presetTargetToDefaultBranch = useCallback(async () => {
      if (!selectedRepo?.text) return;
      try {
        setTargetLoading(true);
        const branches = await store.fetchGitObjectRefsByType(selectedRepo.text, 'branch');
        setTargetGitRefOptions(branches);
        // Try to find default branch if property exists; fallback to 'main'/'master' or first
        let chosen =
          branches?.find((b) => b.isDefault || b.default || b.isBase) ||
          branches?.find((b) => /^(main|master)$/i.test(b.name)) ||
          branches?.[0];
        if (chosen) {
          setGitRefState((prev) => ({
            ...prev,
            target: {
              gitObjType: findGitObjectType('branch'),
              gitObjRef: { key: chosen.value, text: chosen.name },
            },
          }));
        }
      } finally {
        setTargetLoading(false);
      }
    }, [findGitObjectType, selectedRepo?.text, store]);

    const presetTargetToLatestTag = useCallback(async () => {
      if (!selectedRepo?.text) return;
      try {
        setTargetLoading(true);
        const tags = await store.fetchGitObjectRefsByType(selectedRepo.text, 'tag');
        // Sort with latest first by semver; fallback to natural numeric
        const sorted = Array.isArray(tags)
          ? [...tags].sort((a, b) => -compareTagNamesAsc(a?.name, b?.name))
          : [];
        setTargetGitRefOptions(sorted);
        const chosen = sorted?.[0];
        if (chosen) {
          setGitRefState((prev) => ({
            ...prev,
            target: {
              gitObjType: findGitObjectType('tag'),
              gitObjRef: { key: chosen.value, text: chosen.name },
            },
          }));
        }
      } finally {
        setTargetLoading(false);
      }
    }, [compareTagNamesAsc, findGitObjectType, selectedRepo?.text, store]);

    // Helper functions with useCallback
    const processGitData = useCallback(
      async (data) => {
        try {
          const repoList = store.repoList;

          // Set the selected repo
          const repoObj = findRepoById(repoList, data.repoId);
          setSelectedRepo(repoObj ? { key: repoObj.id, text: repoObj.name } : undefined);

          // Find the corresponding objects for gitObjTypes
          const fromTypeObj = findGitObjectType(data.from?.type);
          const toTypeObj = findGitObjectType(data.to?.type);

          // Load reference options and set state
          await loadReferenceOptions(repoObj, fromTypeObj, toTypeObj, data);
        } catch (error) {
          console.error('Error processing git data:', error);
          toast.error('Failed to load git configuration');
        }
      },
      [findGitObjectType, findRepoById, loadReferenceOptions, store.repoList]
    );

    useEffect(() => {
      if (
        editingMode === false &&
        selectedRepo?.key &&
        gitRefState.source.gitObjType.key &&
        gitRefState.source.gitObjRef.key &&
        gitRefState.target.gitObjType.key &&
        gitRefState.target.gitObjRef.key
      ) {
        UpdateDocumentRequestObject();
      }
    }, [selectedRepo, gitRefState, editingMode, UpdateDocumentRequestObject, store?.attachmentWikiUrl]);

    //Reading the loaded selected favorite data
    useEffect(() => {
      if (!dataToRead) return;

      processGitData(dataToRead);
    }, [dataToRead, processGitData, store.repoList]);

    useEffect(() => {
      // Reset the git ref state when a new repo is selected
      if (!dataToRead && selectedRepo.key !== '') {
        setGitRefState(defaultGitRefState);
      }
    }, [dataToRead, selectedRepo]);

    const isFromComplete = Boolean(gitRefState.source.gitObjType.key && gitRefState.source.gitObjRef.key);
    const isRangeComplete = Boolean(
      gitRefState.source.gitObjType.key &&
        gitRefState.source.gitObjRef.key &&
        gitRefState.target.gitObjType.key &&
        gitRefState.target.gitObjRef.key
    );

    return (
      <div>
        <SmartAutocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          loading={store.loadingState.gitRepoLoadingState}
          options={store.repoList.map((repo) => {
            return { key: repo.id, text: repo.name };
          })}
          label='Select a Repo'
          value={selectedRepo}
          onChange={async (event, newValue) => {
            setSelectedRepo(newValue);
          }}
        />
        {selectedRepo.key !== '' && (
          <Grid
            container
            spacing={1}
          >
            {/* Source */}
            <Grid
              item
              xs={12}
            >
              <Divider
                aria-hidden='true'
                textAlign='left'
              >
                <Typography>From</Typography>
              </Divider>
            </Grid>
            <Grid
              item
              xs={4}
            >
              <SmartAutocomplete
                disableClearable
                autoHighlight
                openOnFocus
                size='small'
                options={gitObjType}
                value={gitRefState.source.gitObjType}
                label='Object Type'
                onChange={async (event, newValue) => {
                  setSourceLoading(true);
                  let objects = [];
                  if (newValue.key !== 'commit') {
                    objects = await store.fetchGitObjectRefsByType(selectedRepo.text, newValue.key);
                  } else {
                    objects = await store.fetchGitRepoCommits(selectedRepo.text);
                  }
                  setGitRefState({
                    ...gitRefState,
                    source: {
                      gitObjType: newValue,
                      gitObjRef: defaultGitRefState.source.gitObjRef,
                    },
                    // Clear target when source changes
                    target: defaultGitRefState.target,
                  });
                  setSourceGitRefOptions(objects);
                  // Clear target options as well
                  setTargetGitRefOptions([]);
                  setSourceLoading(false);
                }}
                disabled={sourceLoading}
              />
            </Grid>
            <Grid
              item
              xs={8}
            >
              <SmartAutocomplete
                disableClearable
                openOnFocus
                size='small'
                loading={sourceLoading}
                value={gitRefState.source.gitObjRef}
                options={sourceGitRefOptions.map((ref) => {
                  return { key: ref.value, text: ref.name };
                })}
                renderOption={(props, option) => (
                  <Tooltip title={option.text} placement='right' arrow>
                    <li {...props}>{option.text}</li>
                  </Tooltip>
                )}
                label='Ref'
                onChange={async (event, newValue) => {
                  setGitRefState({
                    ...gitRefState,
                    source: {
                      gitObjType: gitRefState.source.gitObjType,
                      gitObjRef: newValue,
                    },
                    // Clear target when source ref changes
                    target: defaultGitRefState.target,
                  });
                  // Clear target options as well
                  setTargetGitRefOptions([]);
                }}
              />
            </Grid>

            {/* Target */}
            <Grid
              item
              xs={12}
            >
              <Divider
                aria-hidden='true'
                textAlign='left'
              >
                <Typography>To</Typography>
              </Divider>
            </Grid>
            {/* Preset buttons for Target */}
            <Grid
              item
              xs={12}
            >
              {!isFromComplete && (
                <Typography
                  variant='caption'
                  color='text.secondary'
                >
                  Select From type and ref first
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <ButtonGroup
                  size='small'
                  variant='outlined'
                >
                  <Button
                    onClick={presetTargetToHead}
                    disabled={targetLoading || !selectedRepo?.key || !isFromComplete}
                  >
                    HEAD (latest commit)
                  </Button>
                  <Button
                    onClick={presetTargetToDefaultBranch}
                    disabled={targetLoading || !selectedRepo?.key || !isFromComplete}
                  >
                    Default branch
                  </Button>
                  <Button
                    onClick={presetTargetToLatestTag}
                    disabled={targetLoading || !selectedRepo?.key || !isFromComplete}
                  >
                    Latest tag
                  </Button>
                </ButtonGroup>
              </Box>
            </Grid>
            <Grid
              item
              xs={4}
            >
              <SmartAutocomplete
                disableClearable
                autoHighlight
                openOnFocus
                options={gitObjType}
                value={gitRefState.target.gitObjType}
                size='small'
                label='Object Type'
                onChange={async (event, newValue) => {
                  setTargetLoading(true);
                  let objects = [];
                  if (newValue.key !== 'commit') {
                    objects = await store.fetchGitObjectRefsByType(selectedRepo.text, newValue.key);
                  } else {
                    objects = await store.fetchGitRepoCommits(selectedRepo.text);
                  }
                  setGitRefState({
                    ...gitRefState,
                    target: {
                      gitObjType: newValue,
                      gitObjRef: defaultGitRefState.target.gitObjRef,
                    },
                  });
                  setTargetGitRefOptions(objects);
                  setTargetLoading(false);
                }}
                disabled={targetLoading || !isFromComplete}
              />
            </Grid>
            <Grid
              item
              xs={8}
            >
              <SmartAutocomplete
                disableClearable
                openOnFocus
                size='small'
                loading={targetLoading}
                options={targetGitRefOptions.map((ref) => {
                  return { key: ref.value, text: ref.name };
                })}
                value={gitRefState.target.gitObjRef}
                renderOption={(props, option) => (
                  <Tooltip title={option.text} placement='right' arrow>
                    <li {...props}>{option.text}</li>
                  </Tooltip>
                )}
                label='Ref'
                onChange={async (event, newValue) => {
                  setGitRefState({
                    ...gitRefState,
                    target: {
                      gitObjType: gitRefState.target.gitObjType,
                      gitObjRef: newValue,
                    },
                  });
                }}
                disabled={!isFromComplete || targetLoading}
              />
            </Grid>
          </Grid>
        )}

        <br />
        <br />
        {/* Inline summary strip */}
        {isRangeComplete && (
          <Box sx={{ mb: 1 }}>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {`Comparing: ${gitRefState.source.gitObjType.text}:${gitRefState.source.gitObjRef.text} → ${gitRefState.target.gitObjType.text}:${gitRefState.target.gitObjRef.text}`}
            </Typography>
          </Box>
        )}
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

export default GitObjectRangeSelector;
