import React, { useState, useEffect, useCallback } from 'react';
import { PrimaryButton } from '@fluentui/react';
import { Grid, Divider, TextField, Autocomplete, Typography, Tooltip } from '@mui/material';
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
  }) => {
    const [selectedRepo, setSelectedRepo] = useState(defaultItem);

    const [gitRefState, setGitRefState] = useState(defaultGitRefState);

    const [sourceGitRefOptions, setSourceGitRefOptions] = useState([]);
    const [targetGitRefOptions, setTargetGitRefOptions] = useState([]);

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
          const sourceOptions = await loadReferencesForType(repoObj.name, fromTypeObj.key);
          setSourceGitRefOptions(sourceOptions);

          // Load target references
          const targetOptions = await loadReferencesForType(repoObj.name, toTypeObj.key);
          setTargetGitRefOptions(targetOptions);

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
        }
      },
      [loadReferencesForType, processReference]
    );

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
      if (editingMode === false) {
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

    return (
      <div>
        <Autocomplete
          disableClearable
          style={{ marginBlock: 8, width: 300 }}
          autoHighlight
          openOnFocus
          options={store.repoList.map((repo) => {
            return { key: repo.id, text: repo.name };
          })}
          getOptionLabel={(option) => `${option.text}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label='Select a Repo'
              variant='outlined'
            />
          )}
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
              <Autocomplete
                disableClearable
                autoHighlight
                openOnFocus
                size='small'
                options={gitObjType}
                value={gitRefState.source.gitObjType}
                getOptionLabel={(option) => `${option.text}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Object Type'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
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
                  });
                  setSourceGitRefOptions(objects);
                }}
              />
            </Grid>
            <Grid
              item
              xs={8}
            >
              <Autocomplete
                disableClearable
                autoFocus
                openOnFocus
                size='small'
                value={gitRefState.source.gitObjRef}
                options={sourceGitRefOptions.map((ref) => {
                  return { key: ref.value, text: ref.name };
                })}
                getOptionLabel={(option) => `${option.text}`}
                renderOption={(props, option) => (
                  <Tooltip
                    title={option.text}
                    placement='right'
                    arrow
                  >
                    <li {...props}>{option.text}</li>
                  </Tooltip>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Ref'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
                  setGitRefState({
                    ...gitRefState,
                    source: {
                      gitObjType: gitRefState.source.gitObjType,
                      gitObjRef: newValue,
                    },
                  });
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
            <Grid
              item
              xs={4}
            >
              <Autocomplete
                disableClearable
                autoHighlight
                openOnFocus
                options={gitObjType}
                value={gitRefState.target.gitObjType}
                size='small'
                getOptionLabel={(option) => `${option.text}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size='small'
                    label='Object Type'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
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
                }}
              />
            </Grid>
            <Grid
              item
              xs={8}
            >
              <Autocomplete
                disableClearable
                autoFocus
                openOnFocus
                size='small'
                options={targetGitRefOptions.map((ref) => {
                  return { key: ref.value, text: ref.name };
                })}
                value={gitRefState.target.gitObjRef}
                getOptionLabel={(option) => `${option.text}`}
                renderOption={(props, option) => (
                  <Tooltip
                    title={option.text}
                    placement='right'
                    arrow
                  >
                    <li {...props}>{option.text}</li>
                  </Tooltip>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Ref'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
                  setGitRefState({
                    ...gitRefState,
                    target: {
                      gitObjType: gitRefState.target.gitObjType,
                      gitObjRef: newValue,
                    },
                  });
                }}
              />
            </Grid>
          </Grid>
        )}

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

export default GitObjectRangeSelector;
