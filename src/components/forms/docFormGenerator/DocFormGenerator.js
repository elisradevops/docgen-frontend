import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import Grid from '@mui/material/Grid';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { PrimaryButton } from '@fluentui/react';
import CircularProgress from '@mui/material/CircularProgress';
import TestContentSelector from '../../common/TestContentSelector';
import QueryContentSelector from '../../common/QueryContentSelector';
import TraceTableSelector from '../../common/TraceTableSelector';
import ChangeTableSelector from '../../common/ChangeTableSelector';
import STRTableSelector from '../../common/STRTableSelector';
import { Box } from '@mui/material';

const DocFormGenerator = observer(({ docType, store }) => {
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [docTemplates, setDocTemplates] = useState([]);
  const [selectedDocForm, setSelectedDocForm] = useState(null);
  const [docForm, setDocForm] = useState(null);

  useEffect(() => {
    if (docType !== '') {
      setLoadingForm(true);
      store.fetchDocTemplates(docType).then((templates) => {
        setDocTemplates(templates); // Set state after templates are fetched
        setLoadingForm(false);
      });
    }
  }, [store, docType, setDocTemplates]);

  // Automatically select the first doc template when docTemplates change
  useEffect(() => {
    if (docTemplates.length > 0) {
      setSelectedDocForm({
        key: 0,
        text: docTemplates[0].documentTitle, // Automatically selecting the first template
      });
    }
  }, [docTemplates]);

  // Update docForm based on selected document
  useEffect(() => {
    if (selectedDocForm !== null && docTemplates.length > 0) {
      const temp = docTemplates.find((docForm) =>
        docForm.documentTitle.toLowerCase().includes(selectedDocForm.text.toLowerCase())
      );
      setDocForm(temp);
    }
  }, [selectedDocForm, docTemplates]);

  const generateFormControls = (formControl, contentControlIndex) => {
    switch (formControl.skin) {
      case 'test-std':
        return (
          <TestContentSelector
            store={store}
            contentControlTitle={formControl.title}
            type={formControl.type}
            skin={formControl.skin}
            testPlansList={store.testPlansList}
            testSuiteList={store.testSuiteList}
            fetchTestSuitesList={store.fetchTestSuitesList}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
          />
        );
      case 'test-str':
        return (
          <STRTableSelector
            store={store}
            contentControlTitle={formControl.title}
            type={formControl.type}
            skin={formControl.skin}
            testPlansList={store.testPlansList}
            testSuiteList={store.testSuiteList}
            editingMode={false}
            addToDocumentRequestObject={store.addContentControlToDocument}
            contentControlIndex={contentControlIndex}
          />
        );
      case 'trace-table':
        return (
          <TraceTableSelector
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
            store={store}
            type={formControl.type}
            skin={formControl.skin}
            contentControlTitle={formControl.title}
            editingMode={false}
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
    } catch (error) {
      console.error(error);
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
            >
              <Autocomplete
                disableClearable
                style={{ marginBlock: 8, width: 300 }}
                autoHighlight
                openOnFocus
                options={store.teamProjectsList.map((teamProject) => {
                  return { key: teamProject.id, text: teamProject.name };
                })}
                getOptionLabel={(option) => `${option.text}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Select a TeamProject'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
                  store.setTeamProject(newValue.key, newValue.text);
                }}
              />
            </Grid>
            <Grid
              item
              xs={12}
            >
              <Autocomplete
                disableClearable
                style={{ marginBlock: 8, width: 300 }}
                autoHighlight
                openOnFocus
                options={store.templateList
                  .filter((template) => template.name.toLowerCase().includes(docType.toLowerCase()))
                  .map((template) => {
                    return { url: template.url, text: template.name };
                  })}
                getOptionLabel={(option) => `${option.text}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Select a Template'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
                  store.setSelectedTemplate(newValue);
                }}
              />
            </Grid>

            <Grid
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
          </Grid>
        )
      )}
      {/* </Grid> */}
    </Box>
  );
});

export default DocFormGenerator;
