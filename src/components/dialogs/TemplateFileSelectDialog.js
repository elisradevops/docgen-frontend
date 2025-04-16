import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import UploadTemplateFileButton from '../common/UploadTemplateFileButton';
import Subject from '@mui/icons-material/Subject';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logger from '../../utils/logger';

const validDefaultTemplates = ['STD', 'STR', 'Software Version Description'];

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

  const fetchTemplates = useCallback(
    async (docType, selectedTeamProject) => {
      if (docType === '') return;

      setLoadingTemplateFiles(true);

      try {
        // Ensure the MobX action is properly executed
        const templates = await store.fetchTemplatesList(docType, selectedTeamProject);
        setTemplateFiles(templates); // Set templates once fetched

        if (templates.length > 0) {
          const firstMatch = templates.find((t) => {
            const fileName = t.name.split('/').pop().replace('.dotx', '');
            return validDefaultTemplates.includes(fileName);
          });
          const fileObject = { url: firstMatch.url, text: firstMatch.name };
          setSelectedTemplate(fileObject);
          store.setSelectedTemplate(fileObject);
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
    fetchTemplates(docType, selectedTeamProject); // Automatically fetch templates when dependencies change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selectedTeamProject, docType]);

  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleNewFileUploaded = (fileObject) => {
    fetchTemplates(docType, selectedTeamProject);
    if (fileObject) {
      store.setSelectedTemplate(fileObject);
      setSelectedTemplate(fileObject);
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
            <Grid
              container
              spacing={2}
              alignItems='center'
              sx={{ justifyContent: 'center' }}
            >
              <Grid
                item
                xs={8}
                sx={{ display: 'flex', justifyContent: 'center' }} // Center the Autocomplete horizontally
              >
                <Autocomplete
                  disableClearable
                  sx={{ my: 1, width: '500px' }} // Autocomplete takes full width of its grid
                  autoHighlight
                  openOnFocus
                  value={selectedTemplate}
                  options={templateFiles.map((template) => ({
                    url: template.url,
                    text: template.name,
                  }))}
                  getOptionLabel={(option) => option.text}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label='Select a Template'
                      variant='outlined'
                      fullWidth
                    />
                  )}
                  onChange={(event, newValue) => {
                    store.setSelectedTemplate(newValue);
                    setSelectedTemplate(newValue);
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
