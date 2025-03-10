import React, { useState, useEffect } from 'react';
// import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { PrimaryButton } from '@fluentui/react';
import { Box, Radio, RadioGroup, FormLabel, Collapse, Typography } from '@mui/material';
import TraceAnalysisDialog from '../dialogs/TraceAnalysisDialog';

const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;
const defaultSelectedQueries = {
  traceAnalysisMode: 'none',
  reqTestQuery: null,
  testReqQuery: null,
  includeCommonColumnsMode: 'both',
};

const TestContentSelector = ({
  store,
  contentControlTitle,
  type,
  skin,
  testPlansList,
  testSuiteList,
  editingMode,
  sharedQueries,
  addToDocumentRequestObject,
  linkTypeFilterArray,
  contentControlIndex,
}) => {
  const [selectedTestPlan, setSelectedTestPlan] = useState({
    key: '',
    text: '',
  });
  const [selectedTestSuites, setSelectedTestSuites] = useState([]);
  const [includeHardCopyRun, setIncludeHardCopyRun] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [attachmentType, setAttachmentType] = useState('asEmbedded');
  const [includeAttachmentContent, setIncludeAttachmentContent] = useState(false);
  const [isSuiteSpecific, setIsSuiteSpecific] = useState(false);
  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);
  const [includeRequirements, setIncludeRequirements] = useState(false);
  const [includeCustomerId, setIncludeCustomerId] = useState(false);
  const [traceAnalysisRequest, setTraceAnalysisRequest] = useState(defaultSelectedQueries);

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
          includeHardCopyRun: includeHardCopyRun,
          includeAttachmentContent: includeAttachmentContent,
          includeRequirements: includeRequirements,
          includeCustomerId: includeCustomerId,
          traceAnalysisRequest: traceAnalysisRequest,
        },
      },
      contentControlIndex
    );
  }

  const generateIncludedTraceAnalysisSettings = () => {
    const settings = [];
    if (traceAnalysisRequest.includeCommonColumnsMode !== 'both') {
      settings.push(
        `Include Common Columns for ${
          traceAnalysisRequest.includeCommonColumnsMode !== 'reqOnly' ? 'Test Case Only' : 'Requirement Only'
        }`
      );
    }
    if (traceAnalysisRequest.traceAnalysisMode !== 'none') {
      const traceMode =
        traceAnalysisRequest.traceAnalysisMode === 'query' ? 'from Query' : 'from Linked Requirements';
      settings.push(`Requirements ${traceMode}`);

      if (traceAnalysisRequest.traceAnalysisMode === 'query') {
        if (traceAnalysisRequest.reqTestQuery?.value) {
          settings.push(`Requirement to Test Query: ${traceAnalysisRequest.reqTestQuery.value}`);
        }
        if (traceAnalysisRequest.testReqQuery?.value) {
          settings.push(`Test to Requirement Query: ${traceAnalysisRequest.testReqQuery.value}`);
        }
      }
    }

    return (
      <Box>
        <Typography
          variant='subtitle2'
          color='textSecondary'
          sx={{ whiteSpace: 'pre-line' }}
        >
          {settings.length > 0 ? `Included:\n${settings.join('\n')}` : 'No trace analysis settings enabled'}
        </Typography>
      </Box>
    );
  };

  const attachmentTypeElements = (
    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      <div>
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
      </div>
      <div>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeAttachmentContent}
              onChange={(event, checked) => setIncludeAttachmentContent(checked)}
            />
          }
          label='Include Attachment Content'
        />
      </div>
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
            if (newValue.text) {
              let testPlanNameForFile = newValue.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
              store.setContextName(testPlanNameForFile);
            }
            setSelectedTestPlan(newValue);
          }}
        />
      </div>
      <div>
        <FormControlLabel
          label='Generate STD for Manual Formal Testing (Hard Copy)'
          control={
            <Checkbox
              checked={includeHardCopyRun}
              onChange={(event, checked) => setIncludeHardCopyRun(checked)}
            />
          }
        />
      </div>
      <div>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeAttachments}
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
              checked={isSuiteSpecific}
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
            options={testSuiteList}
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
      <TraceAnalysisDialog
        store={store}
        sharedQueries={sharedQueries}
        prevTraceAnalysisRequest={traceAnalysisRequest}
        onTraceAnalysisChange={setTraceAnalysisRequest}
      />
      {generateIncludedTraceAnalysisSettings()}

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
