import React, { useState, useEffect } from 'react';
// import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { PrimaryButton } from '@fluentui/react';
import { Box, Radio, RadioGroup, FormLabel } from '@mui/material';

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
  const [attachmentType, setAttachmentType] = useState('asEmbedded');
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
          attachmentType: attachmentType,
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

  const attachmentTypeElements = (
    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      <FormLabel id='include-office-attachment-radio'>Included Office Files Type</FormLabel>
      <RadioGroup
        defaultValue='asEmbedded'
        name='include-office-attachment-radio'
        value={attachmentType}
        onChange={(event) => {
          setAttachmentType(event.target.value);
        }}
      >
        <FormControlLabel
          value='asEmbedded'
          label='As Embedded'
          control={<Radio />}
        />
        <FormControlLabel
          value='asLink'
          label='As Link'
          control={<Radio />}
        />
      </RadioGroup>
    </Box>
  );

  return (
    <>
      <div>
        {/*
        
        TODO: add this later if needed
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
        /> */}
      </div>
      <div>
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
      </div>
      <div>
        <FormControlLabel
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
        {includeAttachments && attachmentTypeElements}
      </div>
      <div>
        <FormControlLabel
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
          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeCustomerId}
                  onChange={(event, checked) => setIncludeCustomerId(checked)}
                />
              }
              label='Include Customer ID'
            />
          </Box>
        )}
      </div>

      <div>
        <FormControlLabel
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
          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeSeverity}
                  onChange={(event, checked) => setIncludeSeverity(checked)}
                />
              }
              label='Include Severity'
            />
          </Box>
        )}
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              value={isSuiteSpecific}
              onChange={(event, checked) => {
                setIsSuiteSpecific(checked);
              }}
            />
          }
          label='Enable suite specific selection '
        />
      </div>
      <div>
        {isSuiteSpecific ? (
          <Autocomplete
            style={{ marginBlock: 8, width: 300 }}
            multiple
            options={filteredTestSuiteList}
            disableCloseOnSelect
            autoHighlight
            groupBy={(option) => option.parent}
            getOptionLabel={(option) => `${option.name} - (${option.id})`}
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox
                  icon={icon}
                  checkedIcon={checkedIcon}
                  style={{ marginRight: 8 }}
                  checked={selected}
                />
                {`${option.name} - (${option.id})`}
              </li>
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
      </div>
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
    </>
  );
};

export default TestContentSelector;
