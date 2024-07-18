import React, { useState, useEffect } from 'react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormContorlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import { PrimaryButton } from 'office-ui-fabric-react';

const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;

const TestContentSelector = ({
  store,
  contentControlTitle,
  type,
  skin,
  testPlansList,
  testSuiteList,
  editingMode,
  addToDocumentRequestObject,
  linkTypeFilterArray,
  contentControlIndex,
}) => {
  const [selectedTestPlan, setSelectedTestPlan] = useState({
    key: '',
    text: '',
  });
  const [selectedTestSuites, setSelectedTestSuites] = useState([]);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [isSuiteSpecific, setIsSuiteSpecific] = useState(false);
  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);
  const [includeRequirements, setIncludeRequirements] = useState(false);
  const [includeCustomerId, setIncludeCustomerId] = useState(false);
  const [includeBugs, setIncludeBugs] = useState(false);
  const [includeSeverity, setIncludeSeverity] = useState(false);

  useEffect(() => {
    if (editingMode === false) {
      UpdateDocumentRequestObject();
    }
  });

  function UpdateDocumentRequestObject() {
    let testSuiteIdList = undefined;
    if (isSuiteSpecific) {
      testSuiteIdList = []; // Initialize only if the checkbox is checked

      // Function to recursively add children suites
      const addChildrenSuites = (suiteId) => {
        const suite = testSuiteList.find((suite) => suite.id === suiteId);
        if (suite && !testSuiteIdList.includes(suiteId)) {
          testSuiteIdList.push(suiteId);
          const children = testSuiteList.filter((child) => child.parent === suiteId);
          children.forEach((child) => {
            addChildrenSuites(child.id);
          });
        }
      };

      // Add suites selected and their children
      selectedTestSuites.forEach((suite) => {
        addChildrenSuites(suite.id);
      });
    }
    addToDocumentRequestObject(
      {
        type: type,
        title: contentControlTitle,
        skin: skin,
        headingLevel: contentHeadingLevel,
        data: {
          testPlanId: selectedTestPlan.key,
          testSuiteArray: testSuiteIdList,
          includeAttachments: includeAttachments,
          includeRequirements: includeRequirements,
          includeCustomerId: includeCustomerId,
          includeBugs: includeBugs,
          includeSeverity: includeSeverity,
        },
      },
      contentControlIndex
    );
  }

  const filteredTestSuiteList = testSuiteList.slice(1); // Skip the first item of the list

  return (
    <div>
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={headingLevelOptions}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select an Heading level'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          setContentHeadingLevel(newValue.key);
        }}
      />
      <Autocomplete
        disableClearable
        style={{ marginBlock: 8, width: 300 }}
        autoHighlight
        openOnFocus
        options={testPlansList.map((testplan) => {
          return { key: testplan.id, text: testplan.name };
        })}
        getOptionLabel={(option) => `${option.text}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Select a Test Plan'
            variant='outlined'
          />
        )}
        onChange={async (event, newValue) => {
          store.fetchTestSuitesList(newValue.key);
          setSelectedTestPlan(newValue);
        }}
      />
      <FormContorlLabel
        control={
          <Checkbox
            value={includeAttachments}
            onChange={(event, checked) => {
              setIncludeAttachments(checked);
            }}
          />
        }
        label='Include Attachments'
      />
      <FormContorlLabel
        control={
          <Checkbox
            checked={includeRequirements}
            onChange={(event, checked) => {
              setIncludeRequirements(checked);
              if (!checked) setIncludeCustomerId(false); // Ensure Customer ID checkbox is also managed
            }}
          />
        }
        label='Include Requirements'
      />
      {includeRequirements && (
        <FormContorlLabel
          control={
            <Checkbox
              checked={includeCustomerId}
              onChange={(event, checked) => setIncludeCustomerId(checked)}
            />
          }
          label='Include Customer ID'
        />
      )}
      <FormContorlLabel
        control={
          <Checkbox
            checked={includeBugs}
            onChange={(event, checked) => {
              setIncludeBugs(checked);
              if (!checked) setIncludeSeverity(false);
            }}
          />
        }
        label='Include Bugs'
      />
      {includeBugs && (
        <FormContorlLabel
          control={
            <Checkbox
              checked={includeSeverity}
              onChange={(event, checked) => setIncludeSeverity(checked)}
            />
          }
          label='Include Severity'
        />
      )}
      <FormContorlLabel
        control={
          <Checkbox
            value={includeAttachments}
            onChange={(event, checked) => {
              setIsSuiteSpecific(checked);
            }}
          />
        }
        label='Enable suite specific selection '
      />

      {isSuiteSpecific ? (
        <Autocomplete
          style={{ marginBlock: 8, width: 300 }}
          multiple
          options={filteredTestSuiteList}
          disableCloseOnSelect
          autoHighlight
          groupBy={(option) => option.parent}
          getOptionLabel={(option) => `${option.name} - (${option.id})`}
          renderOption={(option, { selected }) => (
            <React.Fragment>
              <Checkbox
                icon={icon}
                checkedIcon={checkedIcon}
                style={{ marginRight: 8 }}
                checked={selected}
              />
              {`${option.name} - (${option.id})`}
            </React.Fragment>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label='With suite cases'
              variant='outlined'
            />
          )}
          onChange={async (event, newValue) => {
            setSelectedTestSuites(newValue);
          }}
        />
      ) : null}
      <br />
      <br />
      {/* works only in document managing mode */}
      {editingMode ? (
        <PrimaryButton
          text='Add Content To Document'
          onClick={() => {
            UpdateDocumentRequestObject();
          }}
        />
      ) : null}
    </div>
  );
};

export default TestContentSelector;
