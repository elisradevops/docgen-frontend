import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import LoadingButton from '@mui/lab/LoadingButton';
import TestContentSelector from '../../common/TestContentSelector';
import QueryContentSelector from '../../common/QueryContentSelector';
import TraceTableSelector from '../../common/TraceTableSelector';
import ChangeTableSelector from '../../common/ChangeTableSelector';
import STRTableSelector from '../../common/STRTableSelector';
import { Box, Collapse, Typography } from '@mui/material';
import TemplateFileSelectDialog from '../../dialogs/TemplateFileSelectDialog';
import { toast } from 'react-toastify';
import logger from '../../../utils/logger';
import FavoriteDialog from '../../dialogs/FavoriteDialog';
import TestReporterSelector from '../../common/TestReporterSelector';

const DocFormGenerator = observer(({ docType, store, selectedTeamProject }) => {
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [docFormsControls, setDocFormsControls] = useState([]);
  const [selectedDocForm, setSelectedDocForm] = useState(null);
  const [docForm, setDocForm] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    if (docType !== '') {
      logger.debug(`Fetching doc forms templates for docType: ${docType}`);
      store.setDocType(docType);
      store.clearLoadedFavorite();
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
  }, [selectedTeamProject]);

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

      default:
        return null;
    }
  };

  const handleSendRequest = async () => {
    setLoading(true);
    try {
      await store.sendRequestToDocGen();
      toast.success(`The request has been generated successfully!`);
    } catch (error) {
      logger.error(`Error occurred while generating document of type ${docType}: ${error.message}`);
      logger.error('Error Stack:', error.stack);
      toast.error(`Failed to generate ${docType}: ${error.message}`, { autoClose: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '400px', width: '100%', overflow: 'hidden' }}>
      {loadingForm ? (
        <CircularProgress />
      ) : (
        selectedDocForm && (
          <Grid
            container
            spacing={2}
            sx={{ width: '100%' }}
            alignItems='flex-start'
            justifyContent='flex-start'
          >
            {docType.toLowerCase() !== 'test-reporter' && (
              <Grid
                item
                xs='auto'
              >
                <TemplateFileSelectDialog
                  store={store}
                  docType={docType}
                  selectedTeamProject={selectedTeamProject}
                  selectedTemplate={selectedTemplate}
                  setSelectedTemplate={setSelectedTemplate}
                />
              </Grid>
            )}

            <Grid
              item
              xs='auto'
            >
              <FavoriteDialog
                isDisabled={!selectedTemplate && docType.toLowerCase() !== 'test-reporter'}
                store={store}
                docType={docType}
                selectedTeamProject={selectedTeamProject}
              />
            </Grid>

            {/* Collapse with proper width handling */}
            <Grid
              item
              xs={12}
            >
              <Collapse
                in={selectedTemplate !== null || docType.toLowerCase() === 'test-reporter'}
                timeout='auto'
                unmountOnExit
                sx={{ width: '100%' }}
              >
                <Box sx={{ width: '100%', px: 1 }}>
                  {selectedTemplate && (
                    <Typography variant='subtitle2'>
                      Template: {selectedTemplate?.text?.split('/')?.pop()}
                    </Typography>
                  )}

                  {/* Content controls grid with proper containment */}
                  <Grid
                    container
                    spacing={3}
                    sx={{ width: '100%' }}
                  >
                    {docForm && docForm.contentControls
                      ? docForm.contentControls.map((contentControl, key) => (
                          <Grid
                            item
                            xs={12}
                            key={key}
                          >
                            <Typography
                              variant='caption'
                              sx={{ m: 1 }}
                            >
                              {contentControl.title}:
                            </Typography>
                            <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                              {generateFormControls(contentControl, key)}
                            </Box>
                          </Grid>
                        ))
                      : null}
                  </Grid>

                  <Box sx={{ mt: 2 }}>
                    <LoadingButton
                      endIcon={<SendIcon />}
                      loading={loading}
                      loadingPosition='end'
                      variant='contained'
                      onClick={handleSendRequest}
                    >
                      Send Request
                    </LoadingButton>
                  </Box>
                </Box>
              </Collapse>
            </Grid>
          </Grid>
        )
      )}
    </Box>
  );
});

export default DocFormGenerator;
