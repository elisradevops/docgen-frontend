import React, { Component } from "react";
import FormContorlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Icon from "@material-ui/core/Icon";
import C from "../../store/constants";

import { getTestSuitesBySuiteId } from "../../store/data/azuredevopsApi";
import { Check } from "office-ui-fabric-react";

export default class SuiteTreeElement extends Component {
  constructor() {
    super();
    this.state = {
      testSuites: [],
    };
  } //constructor
  componentDidMount = () => {
    this.getTestSuitesData(this.props.planId, this.props.suiteId);
  };

  async getTestSuitesData(planId, suiteId) {
    let testSuites = await this.generateSuiteTreeElements(planId, suiteId);
    console.log(testSuites);
    this.setState({ testSuites: testSuites });
  }

  render() {
    return (
      <div>
        <li>
          <Icon>add_circle</Icon>
          <FormContorlLabel
            control={<Checkbox onChange={(event, checked) => {}} />}
            label={this.props.suiteName ? this.props.suiteName : ""}
          />
        </li>
        <ul style={{ "list-style": "none" }}>
          {this.state.testSuites
            ? this.state.testSuites.map((suite, index) => {
                return (
                  <SuiteTreeElement
                    teamProjectName={this.props.teamProjectName}
                    suiteName={suite.name}
                    suiteId={suite.id}
                    planId={this.props.planId}
                    key={index}
                  />
                );
              })
            : null}
        </ul>
      </div>
    );
  }

  async generateSuiteTreeElements(selectedTestPlan, selectedSuite) {
    let suites = await getTestSuitesBySuiteId(
      this.props.teamProjectName,
      selectedTestPlan,
      selectedSuite
    );
    return suites.suites;
  }
}
