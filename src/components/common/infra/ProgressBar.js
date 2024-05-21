import React, { Component } from "react";

import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import LinearProgress from "@material-ui/core/LinearProgress";

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
