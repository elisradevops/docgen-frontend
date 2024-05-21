import React, { useState } from "react";
import { observer } from "mobx-react";
import Grid from "@material-ui/core/Grid";
import Autocomplete from '@material-ui/lab/Autocomplete';
import TextFieldM from '@material-ui/core/TextField';
import { PrimaryButton } from "office-ui-fabric-react";
import CircularProgress from '@material-ui/core/CircularProgress';
import TemplateSelector from "../../common/TemplateSelector";
import TestContentSelector from "../../common/TestContentSelector";
import QueryContentSelector from "../../common/QueryContentSelector";
import TraceTableSelector from "../../common/TraceTableSelector";
import ChangeTableSelector from "../../common/ChangeTableSelector";

const DocFormGenerator = observer(
  ({ index, value, jsonDoc = { contentControls: [] }, store }) => {
    const [loading, setLoading] = useState(false);
    
    const generateFormControls = (formControl, contentControlIndex) => {
      switch (formControl.skin) {
        case "test-std":
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
        case "trace-table":
          return (
            <TraceTableSelector
              store={store}
              contentControlTitle={formControl.title}
              contentControlArrayCell={null}
              editingMode={false}
              addToDocumentRequestObject={store.addToDocumentRequestObject}
            />
          );
        case "table":
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
        case "paragraph":
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
          case "change-table":
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
      <div>
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
              <TextFieldM
                {...params}
                label="Select a TeamProject"
                variant="outlined"
              />
            )}
            onChange={async (event, newValue) => {
              store.setTeamProject(newValue.key, newValue.text);
            }}
          />
          <Autocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={store.templateList.map((template) => {
              return { url: template.url, text: template.name };
            })}
            getOptionLabel={(option) => `${option.text}`}
            renderInput={(params) => (
              <TextFieldM
                {...params}
                label="Select a Template"
                variant="outlined"
              />
            )}
            onChange={async (event, newValue) => {
              store.setSelectedTemplate(newValue);
            }}
          />
        <br />
        <Grid container spacing={3}>
          {jsonDoc.contentControls
            ? jsonDoc.contentControls.map((contentControl, key) => {
                return (
                  <Grid item xs={3}>
                    <typography fontWeight="fontWeughtBold" fontSize={20} m={1}>
                      {contentControl.title}:
                    </typography>
                    {generateFormControls(contentControl,key)}
                  </Grid>
                );
              })
            : null}
        </Grid>

        <PrimaryButton
          text="Send Request"
          onClick={handleSendRequest}
          disabled={loading}
        />
        {loading && <CircularProgress />}
        </div>
    );
  }
);

export default DocFormGenerator;
