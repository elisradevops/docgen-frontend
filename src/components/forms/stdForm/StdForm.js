import React, { Component } from 'react';

import Grid from '@mui/material/Grid';

import TemplateSelector from '../../common/TemplateSelector';
import TestContentSelector from '../../common/TestContentSelector';
import TraceTableSelector from '../../common/TraceTableSelector';
import { PrimaryButton } from '@fluentui/react';
import { sendDocumentTogenerator } from '../../../store/data/docManagerApi';
import logger from '../../../utils/logger';

export default class StdForm extends Component {
  constructor() {
    super();
    this.state = {
      requestJson: {
        teamProjectName: '',
        collectionName: '',
        templateFile: '',
        contentControls: [
          {
            title: 'tests-description-content-control',
            skin: 'test-std',
            headingLevel: 3,
            data: { type: 'test', planId: null, includeAttachments: false },
          },
          {
            title: 'requirements-to-test-cases-content-control',
            skin: 'trace-table',
            headingLevel: 3,
            data: { type: null, planId: null, linkTypeFilterArray: [] },
          },
          {
            title: 'test-cases-to-requirements-content-control',
            skin: 'trace-table',
            headingLevel: 3,
            data: { type: null, planId: null, linkTypeFilterArray: [] },
          },
        ],
      },
      templateList: [],
      selectedTemplate: { name: '', url: '', lastModified: '' },
      isFIxedTemplate: true,
      isEditingContentContorl: false,
      tempContent: {
        title: '',
        skin: '',
        data: {
          type: '',
        },
      },
    };
  } //constructor

  componentDidMount() {
    this.setState({
      requestJson: {
        ...this.state.requestJson,
        ...{
          teamProjectName: this.props.teamProject.toLowerCase(),
          collectionName: this.props.collectionName.toLowerCase(),
        },
      },
    });
  }

  componentWillReceiveProps = (newProps) => {
    this.setState({
      requestJson: {
        ...this.state.requestJson,
        ...{
          teamProjectName: newProps.teamProject.toLowerCase(),
          collectionName: newProps.collectionName.toLowerCase(),
        },
      },
    });
  };

  render() {
    return (
      <div>
        <TemplateSelector setTemplate={this.setTemplate.bind(this)} />
        <Grid
          container
          spacing={3}
        >
          <Grid
            item
            xs={3}
          >
            <br />
            <br />
            <typography
              fontWeight='fontWeughtBold'
              fontSize={20}
              m={1}
            >
              Tests Description:
            </typography>
            <TestContentSelector
              contentControlObject={this.state.requestJson.contentControls[0]}
              updateContentContorl={this.updateTestDescription.bind(this)}
              teamProjectName={this.state.requestJson.teamProjectName}
              enableAttachmentCheckBox={true}
              addContentControlAction={null}
            />
            <br />
            <br />
          </Grid>
          <Grid
            item
            xs={3}
          >
            <br />
            <br />
            <typography
              fontWeight='fontWeughtBold'
              fontSize={20}
              m={1}
            >
              Trace Table(requirments to test cases):
            </typography>
            <TraceTableSelector
              contentControlObject={this.state.requestJson.contentControls[1]}
              teamProjectName={this.state.requestJson.teamProjectName}
              updateContentContorl={this.updateTraceTableRequirments.bind(this)}
              addContentControlAction={null}
            />
            <br />
            <br />
          </Grid>
          <Grid
            item
            xs={3}
          >
            <br />
            <br />
            <typography
              fontWeight='fontWeughtBold'
              fontSize={20}
              m={1}
            >
              Trace Table(test cases to requirments):
            </typography>
            <TraceTableSelector
              contentControlObject={this.state.requestJson.contentControls[2]}
              teamProjectName={this.state.requestJson.teamProjectName}
              updateContentContorl={this.updateTraceTableTestCases.bind(this)}
              addContentControlAction={null}
            />
          </Grid>
        </Grid>
        <br />
        <br />
        <PrimaryButton
          text='Send To Document Generator'
          onClick={() => {
            logger.debug('Sending');
            logger.debug(JSON.stringify(this.state.requestJson));
            sendDocumentTogenerator(this.state.requestJson);
          }}
        />
      </div>
    );
  }

  updateTestDescription(tempContent) {
    console.warn(JSON.stringify(tempContent));
    let request = this.state.requestJson;
    request.contentControls[0] = tempContent;
    this.setState({
      requestJson: request,
    });
    console.warn(this.state.requestJson);
  }

  async updateTraceTableRequirments(tempContent) {
    console.warn(JSON.stringify(tempContent));
    let request = this.state.requestJson;
    request.contentControls[1] = tempContent;
    await this.setState({
      requestJson: request,
    });
    console.warn(JSON.stringify(this.state.requestJson));
  }
  async updateTraceTableTestCases(tempContent) {
    console.warn(JSON.stringify(tempContent));
    let request = this.state.requestJson;
    request.contentControls[2] = tempContent;
    await this.setState({
      requestJson: request,
    });
    console.warn(JSON.stringify(this.state.requestJson));
  }
  setTemplate(event, newValue) {
    this.setState({
      requestJson: {
        ...this.state.requestJson,
        ...{ templateFile: newValue.key },
      },
    });
  }
}
