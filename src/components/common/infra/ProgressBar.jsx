import React, { Component } from 'react';

import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import LinearProgress from '@mui/material/LinearProgress';

export default class ProgressBar extends Component {
  render() {
    return (
      <div>
        <Stepper activeStep={this.props.activeStep}>
          <Step key={0}>
            <StepLabel>Setting up template file</StepLabel>
          </Step>
          <Step key={1}>
            <StepLabel>Getting document data</StepLabel>
          </Step>
          <Step key={2}>
            <StepLabel>Creating word document </StepLabel>
          </Step>
          <Step key={3}>
            <StepLabel>Uploading document</StepLabel>
          </Step>
        </Stepper>
        <LinearProgress />
      </div>
    );
  }
}
