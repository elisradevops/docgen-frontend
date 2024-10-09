import React, { Component } from 'react';
import { getBucketFileList } from '../../store/data/docManagerApi';

import { Dropdown } from '@fluentui/react/lib/Dropdown';

const dropdownStyles = {
  dropdown: { width: 300 },
};

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
        <Dropdown
          placeholder='Select a Template'
          label='Select a Template'
          value={this.state.selectedTemplate.name}
          options={this.state.templateList.map((template) => {
            return { key: template.url, text: template.name };
          })}
          styles={dropdownStyles}
          onChange={(event, newValue) => {
            this.props.setTemplate(event, newValue);
          }}
        />
      </div>
    );
  }
}
