import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import Grid from '@mui/material/Grid';
import SendIcon from '@mui/icons-material/Send';
import TestContentSelector from '../../common/table/TestContentSelector';
import QueryContentSelector from '../../common/selectors/QueryContentSelector';
import TraceTableSelector from '../../common/selectors/TraceTableSelector';
import ChangeTableSelector from '../../common/table/ChangeTableSelector';
import STRTableSelector from '../../common/table/STRTableSelector';
import SRSSelector from '../../common/table/SRSSelector';
import { Box, Button, Collapse, Typography, Paper, Stack } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import TestReporterSelector from '../../common/table/TestReporterSelector';
import { toast } from 'react-toastify';
import logger from '../../../utils/logger';
import { makeKey, tryLocalStorageGet, tryLocalStorageSet } from '../../../utils/storage';
import LoadingState from '../../common/LoadingState';
import TocReminderToast from '../../common/customToasts/TocReminderToast';

const DocFormGenerator = observer(({ docType, store, selectedTeamProject }) => {
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [docFormsControls, setDocFormsControls] = useState([]);
  const [selectedDocForm, setSelectedDocForm] = useState(null);
  const [docForm, setDocForm] = useState(null);

  useEffect(() => {
    if (docType !== '') {
      logger.debug(`Fetching doc forms templates for docType: ${docType}`);
      store.setDocType(docType);
      // Clear selected template when switching doc types so the correct default is chosen
      store.setSelectedTemplate(null);
      store.clearLoadedFavorite();
      // Clear validation states when switching doc types (Edge 92 compatibility)
      store.validationStates = {};
      setLoadingForm(true);
      store
        .fetchDocFormsTemplates(docType)
        .then((docFormsControls) => {
          setDocFormsControls(docFormsControls); // Set state after templates are fetched
          if (docFormsControls.length > 0) {
            const temp = docFormsControls.find((docForm) =>
              docForm.documentTitle.toLowerCase().includes(docType.toLowerCase())
            );
            setDocForm(temp);
          }
        })
        .catch((error) => {
          logger.error(
            `Error occurred while fetching doc forms templates for docType: ${docType}: ${error.message}`
          );
        })
        .finally(() => {
          setLoadingForm(false);
        });
    }
  }, [store, docType, setDocFormsControls]);

  // Automatically select the first doc template when docTemplates change
  useEffect(() => {
    if (docFormsControls.length > 0) {
      setSelectedDocForm({
        key: 0,
        text: docFormsControls[0].documentTitle, // Automatically selecting the first template
      });
    }
  }, [docFormsControls]);

  useEffect(() => {
    if (selectedTeamProject) {
      store.fetchSharedQueries();
    }
  }, [selectedTeamProject, store]);

  // Auto-select default template when none is selected: pick first 'shared' template (fallback to first)
  useEffect(() => {
    const pickDefaultTemplate = async () => {
      if (!docType) return;
      // Don't override if a template is already selected in the store
      if (store.selectedTemplate?.url) return;
      try {
        const templates = await store.fetchTemplatesList(docType, selectedTeamProject);
        if (!Array.isArray(templates) || templates.length === 0) return;

        // Storage key aligned with Templates dialog (namespaced)
        const storageKey = makeKey('template', docType, selectedTeamProject || 'shared');
        const sharedTemplates = templates.filter((t) => String(t.name || '').startsWith('shared/'));
        let chosen = null;

        // 1) Prefer docType-specific default names inside 'shared'
        const base = (n) =>
          String(n || '')
            .split('/')
            .pop()
            .replace(/\.do[ct]x?$/i, '');
        const dt = String(docType || '').toLowerCase();
        const preferNames =
          dt === 'svd'
            ? ['Software Version Description', 'SVD']
            : dt === 'std'
            ? ['STD']
            : dt === 'str'
            ? ['STR']
            : [];
        chosen = sharedTemplates.find((t) => preferNames.includes(base(t.name))) || null;

        // 2) Fallback: first shared
        if (!chosen) {
          chosen = sharedTemplates[0] || null;
        }

        // 3) Respect saved selection only if nothing chosen yet
        if (!chosen) {
          try {
            const saved =
              tryLocalStorageGet(storageKey) ||
              // Legacy fallback (pre-namespace)
              localStorage.getItem(`template:${docType}:${selectedTeamProject || 'shared'}`);
            if (saved) {
              chosen = templates.find((t) => t.url === saved) || null;
            }
          } catch {
            /* empty */
          }
        }

        // 4) Final fallback: first overall
        if (!chosen) {
          chosen = templates[0];
        }

        if (chosen) {
          const fileObject = { url: chosen.url, text: chosen.name };
          store.setSelectedTemplate(fileObject);
          try {
            tryLocalStorageSet(storageKey, fileObject.url);
          } catch {
            /* empty */
          }
        }
      } catch (e) {
        logger.error(`Error while auto-selecting default template: ${e.message}`);
      }
    };
    pickDefaultTemplate();
  }, [docType, selectedTeamProject, store, store.selectedTemplate]);

  // Pre-seed validation as invalid for all currently rendered content controls to avoid initial flicker
  useEffect(() => {
    try {
      const indices = Array.isArray(docForm?.contentControls)
        ? docForm.contentControls.map((_, idx) => idx)
        : [];
      indices.forEach((idx) => {
        const fields = store?.validationStates?.[idx];
        if (!fields || Object.keys(fields).length === 0) {
          store.setValidationState(idx, 'init', {
            isValid: false,
            message: 'Please complete required selections',
          });
        }
      });
      return () => {
        indices.forEach((idx) => {
          try {
            store.clearValidationForIndex(idx, 'init');
          } catch {
            /* empty */
          }
        });
      };
    } catch {
      /* empty */
    }
  }, [docForm?.contentControls, store]);

  const generateFormControls = (formControl, contentControlIndex) => {
    switch (formControl.skin) {
      case 'test-std':
        return (
          <TestContentSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            store={store}
            contentControlTitle={formControl.title}
            type={formControl.type}
            skin={formControl.skin}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
          />
        );
      case 'test-str':
        return (
          <STRTableSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            store={store}
            contentControlTitle={formControl.title}
            type={formControl.type}
            skin={formControl.skin}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
          />
        );
      case 'trace-table':
        return (
          <TraceTableSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            store={store}
            contentControlTitle={formControl.title}
            contentControlArrayCell={null}
            editingMode={false}
            addToDocumentRequestObject={store.addToDocumentRequestObject}
          />
        );
      case 'table':
        return (
          <QueryContentSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            contentControlTitle={formControl.title}
            type={formControl.data.type}
            skin={formControl.skin}
            sharedQueriesList={store.sharedQueries}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            linkTypeFilterArray={null}
          />
        );
      case 'paragraph':
        return (
          <QueryContentSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            contentControlTitle={formControl.title}
            type={formControl.data.type}
            skin={formControl.skin}
            sharedQueriesList={store.sharedQueries}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            linkTypeFilterArray={null}
          />
        );
      case 'change-table':
        return (
          <ChangeTableSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            selectedTeamProject={selectedTeamProject}
            store={store}
            type={formControl.type}
            skin={formControl.skin}
            contentControlTitle={formControl.title}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
            sharedQueries={store.sharedQueries}
          />
        );
      case 'test-reporter':
        store.fetchFieldsByType('Test Case');
        return (
          <TestReporterSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            store={store}
            selectedTeamProject={selectedTeamProject}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
          />
        );
      case 'srs-skin':
        return (
          <SRSSelector
            key={`${selectedTeamProject}-${contentControlIndex}`} // forces re-render
            store={store}
            contentControlTitle={formControl.title}
            type={formControl.type}
            skin={formControl.skin}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
            sharedQueries={store.sharedQueries}
          />
        );

      default:
        return null;
    }
  };

  const handleSendRequest = async () => {
    setLoading(true);
    try {
      await store.sendRequestToDocGen();
      toast.success(`The request has been generated successfully!`);

      // Check if we should show the TOC reminder
      // Show reminder if: 1) a template is selected, and 2) it's a Word document file
      const selectedTemplate = store.selectedTemplate;
      if (selectedTemplate && selectedTemplate.url) {
        const isWordDoc = /\.(docx?|dotx?)$/i.test(selectedTemplate.url);
        if (isWordDoc) {
          toast.info(
            <TocReminderToast
              icon='📋'
              title='Remember to Update Tables of Contents'
              description='Please update all tables in your document:'
              items={['Table of Figures', 'Table of Tables', 'Table of Contents (chapters)']}
              tip='Tip: In Word, press <strong>Ctrl+A</strong> then <strong>F9</strong> to update all fields'
              tipIcon='💡'
            />,
            {
              autoClose: 12000,
              position: 'top-center',
              style: {
                minWidth: '450px',
              },
            }
          );
        }
      }
    } catch (error) {
      logger.error(`Error occurred while generating document of type ${docType}: ${error.message}`);
      logger.error('Error Stack:', error.stack);
      toast.error(`Failed to generate ${docType}: ${error.message}`, {
        autoClose: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Compute validation state for current content controls
  // Use useMemo to ensure it re-computes when validation states change (Edge 92 compatibility)
  const { sendDisabled, validationMessage } = React.useMemo(() => {
    try {
      const indices = new Set(
        Array.isArray(docForm?.contentControls) ? docForm.contentControls.map((_, idx) => idx) : []
      );
      // Convert MobX observable to plain object for Edge 92 compatibility
      const states = store?.validationStates ? JSON.parse(JSON.stringify(store.validationStates)) : {};
      const issues = [];
      Object.entries(states).forEach(([idx, fields]) => {
        if (!indices.has(Number(idx))) return;
        if (!fields) return;
        for (const k of Object.keys(fields)) {
          const entry = fields[k];
          if (entry && entry.isValid === false) {
            issues.push(entry.message || 'Invalid selection');
            break; // one issue per index is enough
          }
        }
      });
      return {
        sendDisabled: issues.length > 0,
        validationMessage: issues[0] || '',
      };
    } catch {
      return { sendDisabled: false, validationMessage: '' };
    }
  }, [docForm?.contentControls, store?.validationStates]);

  // Decide which controls should span full width
  const isWideControl = (control) => {
    try {
      const skin = String(control?.skin || '').toLowerCase();
      if (
        [
          'test-reporter',
          'trace-table',
          'change-table',
          'table',
          'srs-skin',
          'test-str',
          'test-std',
        ].includes(skin)
      )
        return true;
      return false;
    } catch {
      return false;
    }
  };

  const selectedTemplate = store.selectedTemplate;
  const canRenderContent = !!selectedTemplate || String(docType || '').toLowerCase() === 'test-reporter';

  return (
    <Stack
      spacing={1.5}
      sx={{ width: '100%', height: '100%', minHeight: 0 }}
    >
      {loadingForm ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <LoadingState
            title={`Loading ${docType} configuration`}
            subtitle='Fetching templates and content controls'
            columns={[1]}
            rows={4}
          />
        </Box>
      ) : (
        selectedDocForm && (
          <Stack
            spacing={1.5}
            sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
          >
            {canRenderContent ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    pr: { xs: 1, md: 1.5 },
                    pb: 2,
                  }}
                >
                  <Grid
                    container
                    spacing={1.5}
                    sx={{ width: '100%', m: 0 }}
                  >
                    {docForm && docForm.contentControls
                      ? docForm.contentControls.map((contentControl, key) => {
                          const wide = isWideControl(contentControl);
                          return (
                            <Grid
                              size={wide ? 12 : 6}
                              key={key}
                            >
                              <Paper
                                variant='outlined'
                                sx={{
                                  height: '100%',
                                  p: { xs: 1.25, md: 1.5 },
                                  borderRadius: 1.5,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 1,
                                }}
                              >
                                <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                                  {generateFormControls(contentControl, key)}
                                </Box>
                              </Paper>
                            </Grid>
                          );
                        })
                      : null}
                  </Grid>
                </Box>

                <Paper
                  variant='outlined'
                  className='footer-bar'
                  sx={{
                    // Use flexShrink instead of sticky for Edge 92 compatibility
                    flexShrink: 0,
                    mt: 'auto', // Push to bottom
                    mb: '10px', // Lift up by 1px
                    mx: 'auto',
                    maxWidth: 760,
                    width: '100%',
                    px: { xs: 1.75, md: 2.5 },
                    py: { xs: 1.25, md: 1.5 },
                    backgroundColor: (theme) => theme.palette.background.paper,
                    display: 'flex',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    gap: { xs: 1.25, sm: 2 },
                    borderRadius: 999,
                    boxShadow: (theme) => theme.shadows[4],
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'visible',
                  }}
                >
                  <Typography
                    variant='body2'
                    color={sendDisabled ? 'warning.main' : 'text.secondary'}
                    sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}
                  >
                    {sendDisabled
                      ? validationMessage || 'Please complete required selections'
                      : selectedTemplate
                      ? `Ready to generate using template: ${selectedTemplate?.text?.split('/')?.pop()}`
                      : 'Ready to generate'}
                  </Typography>
                  <Tooltip
                    title={sendDisabled ? validationMessage || 'Please complete required selections' : ''}
                    arrow
                  >
                    <span>
                      <Button
                        endIcon={<SendIcon />}
                        loading={loading}
                        loadingPosition='end'
                        variant='contained'
                        size='large'
                        sx={{
                          px: { xs: 2.75, sm: 3 },
                          py: { xs: 0.75, sm: 1 },
                          fontWeight: 600,
                          borderRadius: 2,
                          alignSelf: { xs: 'stretch', sm: 'center' },
                          boxShadow: 'none',
                        }}
                        onClick={handleSendRequest}
                        disabled={sendDisabled || loading}
                      >
                        Send Request
                      </Button>
                    </span>
                  </Tooltip>
                </Paper>
              </Box>
            ) : (
              <Paper
                variant='outlined'
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1.5,
                  color: 'text.secondary',
                }}
              >
                <Typography variant='body2'>Select a template to configure content controls.</Typography>
              </Paper>
            )}
          </Stack>
        )
      )}
    </Stack>
  );
});

export default DocFormGenerator;
