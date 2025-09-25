import React, { Component } from 'react';
import { getBucketFileList } from '../../../store/data/docManagerApi';

import { MenuItem, Select } from '@mui/material';

export default class TemplateSelector extends Component {
  constructor() {
    super();
    this.state = {
      templateList: [],
      selectedTemplate: { name: '', url: '', lastModified: '' },
      isFIxedTemplate: true,
    };
  } //constructor

  componentDidMount() {
    this.setSharedTemplates('templates');
  }

  async setSharedTemplates(bucketName) {
    let sharedTemplates = await getBucketFileList(bucketName);
    this.setState({ templateList: sharedTemplates });
  }

  render() {
    return (
      <div>
        <Select
          label='Select a Template'
          sx={{ width: 300 }}
          value={this.state.selectedTemplate.name}
          onChange={(event, newValue) => {
            this.props.setTemplate(event, newValue);
          }}
        >
          {this.state.templateList.map((template) => {
            return (
              <MenuItem
                key={template.url}
                value={template.name}
              >
                {template.name}
              </MenuItem>
            );
          })}
        </Select>
      </div>
    );
  }
}
