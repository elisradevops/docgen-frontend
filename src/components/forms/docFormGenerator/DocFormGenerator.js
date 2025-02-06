import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import { PrimaryButton } from '@fluentui/react';
import CircularProgress from '@mui/material/CircularProgress';
import TestContentSelector from '../../common/TestContentSelector';
import QueryContentSelector from '../../common/QueryContentSelector';
import TraceTableSelector from '../../common/TraceTableSelector';
import ChangeTableSelector from '../../common/ChangeTableSelector';
import STRTableSelector from '../../common/STRTableSelector';
import { Box, Collapse } from '@mui/material';
import TemplateFileSelectDialog from '../../dialogs/TemplateFileSelectDialog';
import { toast } from 'react-toastify';
import logger from '../../../utils/logger';

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
      setLoadingForm(true);
      store
        .fetchDocFormsTemplates(docType)
        .then((docFormsControls) => {
          setDocFormsControls(docFormsControls); // Set state after templates are fetched
          setLoadingForm(false);
        })
        .catch(() => {
          setLoadingForm(false); // Ensure loading state is reset if there's an error
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

  // Update docForm based on selected document
  useEffect(() => {
    if (selectedDocForm !== null && docFormsControls.length > 0) {
      const temp = docFormsControls.find((docForm) =>
        docForm.documentTitle.toLowerCase().includes(selectedDocForm.text.toLowerCase())
      );
      setDocForm(temp);
    }
  }, [selectedDocForm, docFormsControls]);

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
            testPlansList={store.testPlansList}
            testSuiteList={store.testSuiteList}
            fetchTestSuitesList={store.fetchTestSuitesList}
            sharedQueries={store.sharedQueries}
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
            testPlansList={store.testPlansList}
            testSuiteList={store.testSuiteList}
            sharedQueries={store.sharedQueries}
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
      toast.error(`Failed to generate ${docType}: ${error.message}`, { autoClose: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '400px' }}>
      {loadingForm ? (
        <CircularProgress />
      ) : (
        selectedDocForm && (
          <Grid container>
            <Grid
              item
              xs={12}
              sx={{ justifyContent: 'center' }}
            >
              <TemplateFileSelectDialog
                store={store}
                docType={docType}
                selectedTeamProject={selectedTeamProject}
                selectedTemplate={selectedTemplate}
                setSelectedTemplate={setSelectedTemplate}
              />
            </Grid>
            <Collapse
              in={selectedTemplate !== null}
              timeout='auto'
              unmountOnExit
            >
              <TextField
                label='Selected Template'
                defaultValue=''
                value={selectedTemplate?.text?.split('/')?.pop()}
                InputProps={{
                  readOnly: true,
                }}
                variant='standard'
                sx={{ my: 2, width: 300 }}
              />
              <Grid
                sx={{ pt: 1 }}
                container
                item
                spacing={3}
              >
                {docForm && docForm.contentControls
                  ? docForm.contentControls.map((contentControl, key) => {
                      return (
                        <Grid item>
                          <typography
                            fontWeight='fontWeightBold'
                            fontSize={20}
                            m={1}
                          >
                            {contentControl.title}:
                          </typography>
                          {generateFormControls(contentControl, key)}
                        </Grid>
                      );
                    })
                  : null}
              </Grid>
              <Grid
                item
                xs={12}
              >
                <PrimaryButton
                  text='Send Request'
                  onClick={handleSendRequest}
                  disabled={loading}
                />
                {loading && <CircularProgress />}
              </Grid>
            </Collapse>
          </Grid>
        )
      )}
      {/* </Grid> */}
    </Box>
  );
});

export default DocFormGenerator;
