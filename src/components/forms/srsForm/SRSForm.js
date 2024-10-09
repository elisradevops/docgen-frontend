import React, { Component } from 'react';

import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { TextField } from '@fluentui/react/lib/TextField';
import { PrimaryButton } from '@fluentui/react';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';

import { contentTypeOptions, headingLevelOptions } from '../../../store/data/dropDownOptions';
import { getSharedQueries } from '../../../store/data/azuredevopsApi';
import { getBucketFileList, sendDocumentTogenerator } from '../../../store/data/docManagerApi';

const dropdownStyles = {
  dropdown: { width: 300 },
};

export default class SRSForm extends Component {
  constructor() {
    super();
    this.state = {
      requestJson: {
        projectName: '',
        templateFile: '',
        contentControls: [],
      },
      sharedQueriesList: [],
      templateList: [],
      selectedTemplate: { name: '', url: '', lastModified: '' },
      isFixedTemplate: true,
      isEditingContentContorl: false,
      tempContent: {
        title: '',
        skin: '',
        headingLevel: 1,
        data: {
          type: '',
          queryId: '',
        },
      },
    };
  } //constructor
  componentWillReceiveProps = (newProps) => {
    console.log(newProps.collectionName);
    this.setState({
      requestJson: {
        ...this.state.requestJson,
        ...{
          projectName: newProps.teamProject.toLowerCase(),
          collectionName: newProps.collectionName.toLowerCase(),
        },
      },
    });
  };
  componentDidMount() {
    this.setSharedTemplates('templates');
    this.getSharedQueries();
  }
  componentDidUpdate() {
    this.getSharedQueries();
  }
  async getSharedQueries() {
    if (this.state.requestJson.collectionName === undefined) {
      return [];
    }
    let sharedQueries = await getSharedQueries(
      this.state.requestJson.collectionName,
      this.state.requestJson.projectName
    );
    this.setState({ sharedQueriesList: sharedQueries });
  }
  async setSharedTemplates(bucketName) {
    let sharedTemplates = await getBucketFileList(bucketName);
    this.setState({ templateList: sharedTemplates });
  }
  render() {
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
            <Dropdown
              placeholder='Select a Template'
              label='Select a Template'
              value={this.state.selectedTemplate.name}
              options={this.state.templateList.map((template) => {
                return { key: template.url, text: template.name };
              })}
              styles={dropdownStyles}
              onChange={(event, newValue) => {
                this.setState({
                  requestJson: {
                    ...this.state.requestJson,
                    ...{ templateFile: newValue.key },
                  },
                });
              }}
            />
            <TextField
              label='Content Control Name '
              required
              placeholder='Example: system-capabilities'
              onChange={(event, newValue) => {
                if (newValue === '') {
                  this.setState({
                    tempContent: {
                      ...this.state.tempContent,
                      ...{ title: newValue },
                    },
                    isEditingContentContorl: false,
                  });
                } else {
                  this.setState({
                    tempContent: {
                      ...this.state.tempContent,
                      ...{ title: newValue },
                    },
                    isEditingContentContorl: true,
                  });
                }
              }}
            />

            {this.state.isEditingContentContorl ? (
              <div>
                <Dropdown
                  placeholder='Select an Heading level'
                  label='Select an Heading level'
                  value={this.state.tempContent.headingLevel}
                  options={headingLevelOptions}
                  styles={dropdownStyles}
                  onChange={(event, newValue) => {
                    this.setState({
                      tempContent: {
                        ...this.state.tempContent,
                        ...{ headingLevel: newValue.key },
                      },
                    });
                  }}
                />
                <Dropdown
                  placeholder='Select a content contorl type'
                  value={'queryTable'}
                  label='Select a content control type'
                  options={contentTypeOptions}
                  styles={dropdownStyles}
                  onChange={(event, newValue) => {
                    let newTempContent = this.state.tempContent;
                    newTempContent.data.type = newValue.dataType;
                    newTempContent.skin = newValue.skinType;
                    this.setState({ tempContent: newTempContent });
                  }}
                />
                {this.state.tempContent.data.type === 'query' ? (
                  <Dropdown
                    placeholder='Select a Query from shared Queries'
                    label='Select a Query'
                    options={this.state.sharedQueriesList.map((query) => {
                      return { key: query.queryId, text: query.name };
                    })}
                    styles={dropdownStyles}
                    onChange={(event, newValue) => {
                      let newTempContent = this.state.tempContent;
                      newTempContent.data.queryId = newValue.key;
                      this.setState({ tempContent: newTempContent });
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            <br />
            <PrimaryButton
              text='Add Content-Control'
              onClick={() => {
                let tempreq = this.state.requestJson;
                tempreq.contentControls.push(this.state.tempContent);
                this.setState({ requestJson: tempreq });
              }}
            />
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
                console.log('Sending');
                sendDocumentTogenerator(this.state.requestJson);
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
              value={`${JSON.stringify(this.state.requestJson)}`}
              onChange={(event, newValue) => {
                this.setState({
                  requestJson: newValue,
                });
              }}
            />
            <TextField
              label='Current Content Control JSON:'
              multiline
              rows={15}
              value={`${JSON.stringify(this.state.tempContent)}`}
            />
            <br />
            <br />
            {this.state.requestJson.contentControls
              ? this.state.requestJson.contentControls.map((content, i) => (
                  <Chip
                    clickable
                    color='primary'
                    label={content.title}
                    key={i}
                    onClick={(e) => {
                      let newRequest = this.state.requestJson;
                      newRequest.contentControls.splice(i, 1);
                      this.setState({ requestJson: newRequest });
                    }}
                  />
                ))
              : null}
          </Grid>
        </Grid>
      </div>
    );
  } //render
}
