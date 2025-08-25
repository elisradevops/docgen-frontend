import React, { useState } from 'react';
import { observer } from 'mobx-react';

import { contentTypeOptions } from '../../../store/data/dropDownOptions';

import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { TextField } from '@fluentui/react/lib/TextField';

import { PrimaryButton } from '@fluentui/react';
import Grid from '@mui/material/Grid';
import SmartAutocomplete from '../../common/SmartAutocomplete';

import TestContentSelector from '../../common/TestContentSelector';
import QueryContentSelector from '../../common/QueryContentSelector';
import TraceTableSelector from '../../common/TraceTableSelector';
import ChangeTableSelector from '../../common/ChangeTableSelector';
import fileDownload from 'js-file-download';
import STRTableSelector from '../../common/STRTableSelector';

const DeveloperForm = observer(({ store }) => {
  const [contentControlTitle, setContentControlTitle] = useState(null);
  const [contentControlType, setContentControlType] = useState('');
  const [contentControlSkin, setContentControlSkin] = useState('');

  const addToDocumentRequestObject = (contentControlObject) => {
    store.addContentControlToDocument(contentControlObject);
  };

  return (
    <div>
      <Grid
        container
        spacing={3}
      >
        <Grid
          item
          xs={6}
        >
          <TextField
            style={{ marginBlock: 8, width: 300 }}
            label='Enter Form Name '
            required
            placeholder='Example: STD'
            onChange={(event, newValue) => {
              store.setDocumentTitle(newValue);
            }}
          />
          <SmartAutocomplete
            disableClearable
            style={{ marginBlock: 8, width: 300 }}
            autoHighlight
            openOnFocus
            options={store.templateList.map((template) => ({ url: template.url, text: template.name }))}
            label='Select a Template'
            onChange={async (_e, newValue) => {
              store.setSelectedTemplate(newValue);
            }}
          />
          <TextField
            label='Content Control Name '
            required
            placeholder='Example: system-capabilities'
            onChange={(event, newValue) => {
              setContentControlTitle(newValue);
            }}
          />
          {contentControlTitle ? (
            <div>
              <Dropdown
                placeholder='Select a content contorl type'
                value={contentControlType}
                label='Select a content control type'
                options={contentTypeOptions}
                onChange={(event, newValue) => {
                  setContentControlType(newValue.dataType);
                  setContentControlSkin(newValue.skinType);
                }}
              />
              {contentControlType === 'test' && contentControlSkin === 'test-std' ? (
                <TestContentSelector
                  store={store}
                  contentControlTitle={contentControlTitle}
                  type={contentControlType}
                  skin={contentControlSkin}
                  editingMode={true}
                  addToDocumentRequestObject={addToDocumentRequestObject}
                />
              ) : null}
              {contentControlSkin === 'test-str' ? (
                <STRTableSelector
                  store={store}
                  contentControlTitle={contentControlTitle}
                  type={contentControlType}
                  skin={contentControlSkin}
                  editingMode={false}
                  addToDocumentRequestObject={store.addContentControlToDocument}
                />
              ) : null}
              {contentControlType === 'query' ? (
                <QueryContentSelector
                  contentControlTitle={contentControlTitle}
                  teamProjectName={store.teamProject}
                  type={contentControlType}
                  skin={contentControlSkin}
                  sharedQueriesList={store.sharedQueries}
                  contentControlArrayCell={null}
                  editingMode={true}
                  addToDocumentRequestObject={addToDocumentRequestObject}
                />
              ) : null}
              {contentControlSkin === 'trace-table' ? (
                <TraceTableSelector
                  store={store}
                  contentControlTitle={contentControlTitle}
                  contentControlArrayCell={null}
                  editingMode={true}
                  addToDocumentRequestObject={addToDocumentRequestObject}
                />
              ) : null}
              {contentControlSkin === 'change-table' ? (
                <ChangeTableSelector
                  store={store}
                  type={contentControlType}
                  skin={contentControlSkin}
                  contentControlTitle={contentControlTitle}
                  editingMode={true}
                  addToDocumentRequestObject={addToDocumentRequestObject}
                />
              ) : null}
            </div>
          ) : null}
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <PrimaryButton
            text='Send To Document Generator'
            onClick={() => {
              store.sendRequestToDocGen();
            }}
          />
        </Grid>
        <Grid
          item
          xs={6}
        >
          <TextField
            label='Request JSON:'
            multiline
            rows={15}
            value={`${JSON.stringify(store.requestJson)}`}
          />
          <br />
          <PrimaryButton
            text='Download Request JSON'
            onClick={() => {
              fileDownload(JSON.stringify(store.requestJson), 'request.json');
            }}
          />
          <br />
          <br />
        </Grid>
      </Grid>
    </div>
  );
});

export default DeveloperForm;
