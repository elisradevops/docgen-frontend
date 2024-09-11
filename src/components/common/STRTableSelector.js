import React, { useState, useEffect } from 'react';
import { headingLevelOptions } from '../../store/data/dropDownOptions';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import { PrimaryButton } from 'office-ui-fabric-react';
import { Box, FormControl, Radio, RadioGroup } from '@material-ui/core';

const icon = <CheckBoxOutlineBlankIcon fontSize='small' />;
const checkedIcon = <CheckBoxIcon fontSize='small' />;

const STRTableSelector = ({
  store,
  contentControlTitle,
  type,
  skin,
  testPlansList,
  testSuiteList,
  addToDocumentRequestObject,
  editingMode,
  contentControlIndex,
}) => {
  const [selectedTestPlan, setSelectedTestPlan] = useState({
    key: '',
    text: '',
  });
  const [selectedTestSuites, setSelectedTestSuites] = useState([]);
  const [contentHeadingLevel, setContentHeadingLevel] = useState(1);
  const [includeConfigurations, setIncludeConfigurations] = useState(false);
  const [includeDetailedStepsExecution, setIncludeDetailedStepsExecution] = useState(false);
  const [includeHierarchy, setIncludeHierarchy] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [includeCoveredRequirements, setIncludeCoveredRequirements] = useState(false);
  const [includeLinkedPCRs, setIncludeLinkedPCRs] = useState(false);
  const [includeTraceAnalysis, setIncludeTraceAnalysis] = useState(false);
  const [traceAnalysisSelection, setTraceAnalysisSelection] = useState('');
  const [includeOpenPCRs, setIncludeOpenPCRs] = useState(false);
  const [openPCRsSelection, setOpenPCRsSelection] = useState('');
  const [includeTestLog, setIncludeTestLog] = useState(false);

  useEffect(() => {
    if (editingMode === false) {
      UpdateDocumentRequestObject();
    }
  });
  // }, [editingMode]);

  useEffect(() => {
    if (!includeDetailedStepsExecution) {
      setIncludeAttachments(false);
      setIncludeCoveredRequirements(false);
      setIncludeLinkedPCRs(false);
      setIncludeTestLog(false);
    }
  }, [includeDetailedStepsExecution]);

  function UpdateDocumentRequestObject() {
    let testSuiteIdList = undefined;

    testSuiteIdList = [];

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
    addToDocumentRequestObject(
      {
        type: type,
        title: contentControlTitle,
        skin: skin,
        headingLevel: contentHeadingLevel,
        data: {
          testPlanId: selectedTestPlan.key,
          testSuiteArray: testSuiteIdList,
          includeConfigurations: includeConfigurations,
          includeHierarchy: includeHierarchy,
        },
      },
      contentControlIndex
    );
  }

  const filteredTestSuiteList = testSuiteList.slice(1); // Skip the first item of the list

  const traceAnalysisOptions = (
    <FormControl sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      <RadioGroup
        defaultValue='query'
        name='trace-analysis-buttons-group'
        value={traceAnalysisSelection}
        onChange={(event) => {
          setTraceAnalysisSelection(event.target.value);
        }}
      >
        <FormControlLabel
          value='query'
          label='From Query'
          control={<Radio />}
        />
        <FormControlLabel
          value='linked'
          label='From Linked Requirements'
          control={<Radio />}
        />
      </RadioGroup>
    </FormControl>
  );

  const detailedExecutionStepsElements = (
    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      <FormControlLabel
        label='Generate Attachments'
        control={
          <Checkbox
            value={includeAttachments}
            onChange={(event, checked) => {
              setIncludeAttachments(checked);
            }}
          />
        }
      />
      <FormControlLabel
        label='Generate Covered Requirements'
        control={
          <Checkbox
            value={includeCoveredRequirements}
            onChange={(event, checked) => {
              setIncludeCoveredRequirements(checked);
            }}
          />
        }
      />

      <FormControlLabel
        label='Generate Linked PCRs'
        control={
          <Checkbox
            value={includeLinkedPCRs}
            onChange={(event, checked) => {
              setIncludeLinkedPCRs(checked);
            }}
          />
        }
      />
      <div>
        <FormControlLabel
          label='Trace Analysis'
          control={
            <Checkbox
              value={includeTraceAnalysis}
              onChange={(event, checked) => {
                setIncludeTraceAnalysis(checked);
              }}
            />
          }
        />
        {includeTraceAnalysis && traceAnalysisOptions}
      </div>
    </Box>
  );

  const openPcrsElements = (
    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
      <RadioGroup
        defaultValue='query'
        name='open-pcr-buttons-group'
        value={openPCRsSelection}
        onChange={(event) => {
          setOpenPCRsSelection(event.target.value);
        }}
      >
        <FormControlLabel
          value='query'
          label='From Query'
          control={<Radio />}
        />
        <FormControlLabel
          value='linked'
          label='From Linked CR / Bugs'
          control={<Radio />}
        />
      </RadioGroup>
    </Box>
  );

  return (
    <>
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
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              value={includeConfigurations}
              onChange={(event, checked) => {
                setIncludeConfigurations(checked);
              }}
            />
          }
          label='Display Configuration Name'
        />
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              value={includeHierarchy}
              onChange={(event, checked) => {
                setIncludeHierarchy(checked);
              }}
            />
          }
          label='Display Test Group Hierarchy'
        />
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              value={includeDetailedStepsExecution}
              onChange={(event, checked) => {
                setIncludeDetailedStepsExecution(checked);
              }}
            />
          }
          label='Generate Detailed Steps Execution'
        />

        {includeDetailedStepsExecution && detailedExecutionStepsElements}
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              value={includeOpenPCRs}
              onChange={(event, checked) => {
                setIncludeOpenPCRs(checked);
              }}
            />
          }
          label='Open PCRs'
        />

        {includeOpenPCRs && openPcrsElements}
      </div>

      <div>
        <FormControlLabel
          control={
            <Checkbox
              value={includeTestLog}
              onChange={(event, checked) => {
                setIncludeTestLog(checked);
              }}
            />
          }
          label='Test Log'
        />
      </div>

      <br />
      <br />
      {/* works only in document managing mode */}
      {editingMode ? (
        <PrimaryButton
          disabled={selectedTestSuites.length === 0}
          text='Add Content To Document'
          onClick={() => {
            UpdateDocumentRequestObject();
          }}
        />
      ) : null}
    </>
  );
};

export default STRTableSelector;
