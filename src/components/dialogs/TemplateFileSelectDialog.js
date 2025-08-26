import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Chip,
} from '@mui/material';
import SmartAutocomplete from '../common/SmartAutocomplete';
import React, { useCallback, useEffect, useState } from 'react';
import UploadTemplateFileButton from '../common/UploadTemplateFileButton';
import Subject from '@mui/icons-material/Subject';
// Removed inline open/delete actions; management handled in TemplatesTab
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logger from '../../utils/logger';
import { makeKey, tryLocalStorageGet, tryLocalStorageSet } from '../../utils/storage';

const validDefaultTemplates = ['STD', 'STR', 'SVD', 'Software Version Description'];

export const TemplateFileSelectDialog = ({
  store,
  docType,
  selectedTeamProject,
  selectedTemplate,
  setSelectedTemplate,
}) => {
  const [templateFiles, setTemplateFiles] = useState([]);
  const [loadingTemplateFiles, setLoadingTemplateFiles] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  const storageKey = (docType, project) => makeKey('template', docType, project || 'shared');
  const formatWhen = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };

  const fetchTemplates = useCallback(
    async (docType, selectedTeamProject) => {
      if (docType === '') return;

      setLoadingTemplateFiles(true);

      try {
        // Ensure the MobX action is properly executed
        const templates = await store.fetchTemplatesList(docType, selectedTeamProject);
        setTemplateFiles(templates); // cache

        // Do not override if a template is already selected (e.g., via Favorites)
        const alreadySelected = store.selectedTemplate?.url || selectedTemplate?.url;

        if (templates.length > 0 && !alreadySelected) {
          const sharedTemplates = templates.filter((t) => String(t.name || '').startsWith('shared/'));
          let chosen = null;

          // 1) Prefer docType-specific default names inside 'shared'
          const base = (n) => String(n || '').split('/').pop().replace('.dotx', '');
          const dt = String(docType || '').toLowerCase();
          const preferNames =
            dt === 'svd' ? ['Software Version Description', 'SVD'] :
            dt === 'std' ? ['STD'] :
            dt === 'str' ? ['STR'] : [];
          chosen = sharedTemplates.find((t) => preferNames.includes(base(t.name))) || null;

          // 2) Fallback: first shared
          if (!chosen) {
            chosen = sharedTemplates[0] || null;
          }

          // 3) Respect saved selection only if nothing chosen yet
          if (!chosen) {
            try {
              const saved =
                tryLocalStorageGet(storageKey(docType, selectedTeamProject)) ||
                // Legacy (pre-namespace) fallback
                localStorage.getItem(`template:${docType}:${selectedTeamProject || 'shared'}`);
              if (saved) {
                chosen = templates.find((t) => t.url === saved) || null;
              }
            } catch {}
          }

          // 4) Final fallback: first overall
          if (!chosen) {
            chosen = templates[0];
          }

          if (chosen) {
            const fileObject = { url: chosen.url, text: chosen.name };
            setSelectedTemplate(fileObject);
            store.setSelectedTemplate(fileObject);
            try {
              tryLocalStorageSet(storageKey(docType, selectedTeamProject), fileObject.url);
            } catch {}
          }
        }
      } catch (err) {
        logger.error('Error fetching template files:', err.message);
        toast.error(`Error while fetching template files: ${err.message}`, { autoClose: false });
      } finally {
        setLoadingTemplateFiles(false); // Ensure loading state is turned off
      }
    },
    [setSelectedTemplate, store]
  );

  useEffect(() => {
    if (openDialog) {
      fetchTemplates(docType, selectedTeamProject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selectedTeamProject, docType, openDialog]);

  const handleClickOpen = () => {
    setOpenDialog(true);
    // Fetch on open to avoid unnecessary background fetches
    fetchTemplates(docType, selectedTeamProject);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleNewFileUploaded = (fileObject) => {
    fetchTemplates(docType, selectedTeamProject);
    if (fileObject) {
      store.setSelectedTemplate(fileObject);
      setSelectedTemplate(fileObject);
      try {
        tryLocalStorageSet(storageKey(docType, selectedTeamProject), fileObject.url);
      } catch {}
      toast.success(`Template uploaded and selected: ${fileObject.text.split('/').pop()}`);
    }
  };

  return (
    <>
      <Button
        variant='contained'
        onClick={handleClickOpen}
        startIcon={<Subject />}
      >
        Templates
      </Button>
      <Dialog
        open={openDialog}
        onClose={handleClose}
      >
        <DialogTitle>Templates</DialogTitle>
        <DialogContent>
          {loadingTemplateFiles ? (
            <CircularProgress />
          ) : (
            <Grid container spacing={2} alignItems='center' sx={{ justifyContent: 'center' }}>

              {/* Empty state */}
              {templateFiles.length === 0 ? (
                <Grid item xs={12} sx={{ textAlign: 'center' }}>
                  <Alert severity='info' sx={{ mb: 2 }}>
                    No templates found{selectedTeamProject ? ` for project "${selectedTeamProject}"` : ''}.
                  </Alert>
                  {selectedTeamProject ? (
                    <UploadTemplateFileButton
                      store={store}
                      onNewFileUpload={handleNewFileUploaded}
                      bucketName={'templates'}
                    />
                  ) : (
                    <Alert severity='info'>Select a project to upload a new template</Alert>
                  )}
                </Grid>
              ) : null}

              <Grid
                item
                xs={8}
                sx={{ display: 'flex', justifyContent: 'center' }} // Center the Autocomplete horizontally
              >
                <SmartAutocomplete
                  disableClearable
                  sx={{ my: 1, width: '500px' }}
                  autoHighlight
                  openOnFocus
                  value={selectedTemplate}
                  optionValueKey='url'
                  options={templateFiles.map((template) => {
                    const [source, ...rest] = String(template.name || '').split('/');
                    return {
                      url: template.url,
                      text: template.name,
                      source: source || 'shared',
                      lastModified: template.lastModified,
                      file: template, // keep original for delete
                    };
                  })}
                  searchKeys={['text', 'source']}
                  noOptionsText='No templates'
                  textFieldProps={{
                    onKeyDown: (e) => {
                      if (e.key === 'Enter') setOpenDialog(false);
                    },
                  }}
                  renderOption={(props, option, state) => {
                    const fileLabel = option.text?.split('/').pop()?.replace('.dotx', '');
                    return (
                      <li
                        {...props}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{fileLabel}</span>
                          <span style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center' }}>
                            {option.source === 'shared' && (
                              <Chip size='small' label='Shared' sx={{ mr: 1 }} />
                            )}
                            {option.lastModified ? `Updated ${formatWhen(option.lastModified)}` : ''}
                          </span>
                        </div>
                      </li>
                    );
                  }}
                  label='Select a Template'
                  onChange={(_e, newValue) => {
                    if (newValue) {
                      store.setSelectedTemplate(newValue);
                      setSelectedTemplate(newValue);
                      try {
                        tryLocalStorageSet(storageKey(docType, selectedTeamProject), newValue.url);
                      } catch {}
                    }
                  }}
                />
              </Grid>
              <Grid
                item
                xs={4}
              >
                {selectedTeamProject ? (
                  <UploadTemplateFileButton
                    store={store}
                    onNewFileUpload={handleNewFileUploaded}
                    bucketName={'templates'}
                  />
                ) : (
                  <Alert severity='info'>For upload a new template please select a project</Alert>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TemplateFileSelectDialog;
