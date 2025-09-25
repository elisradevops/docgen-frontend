import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import {
  Box,
  Radio,
  RadioGroup,
  FormLabel,
  Grid,
  Button,
  Typography,
  Stack,
  Divider,
} from '@mui/material';
import TraceAnalysisDialog from '../../dialogs/TraceAnalysisDialog';
import { observer } from 'mobx-react';
import { validateQuery } from '../../../utils/queryValidation';
import { toast } from 'react-toastify';
import LinkedMomDialog from '../../dialogs/LinkedMomDialog';
import SettingsDisplay from '../SettingsDisplay';
import SmartAutocomplete from '../SmartAutocomplete';
import SectionCard from '../../layout/SectionCard';

const defaultSelectedQueries = {
  traceAnalysisMode: 'none',
  reqTestQuery: null,
  testReqQuery: null,
  includeCommonColumnsMode: 'both',
};

const defaultLinkedMomRequest = {
  linkedMomMode: 'none',
  linkedMomQuery: null,
};

const TestContentSelector = observer(
  ({
    store,
    contentControlTitle,
    type,
    skin,
    editingMode,
    addToDocumentRequestObject,
    contentControlIndex,
  }) => {
    const [selectedTestPlan, setSelectedTestPlan] = useState({ key: '', text: '' });
    const [selectedTestSuites, setSelectedTestSuites] = useState([]);
    const [isSuiteSpecific, setIsSuiteSpecific] = useState(false);

    const [includeHardCopyRun, setIncludeHardCopyRun] = useState(false);
    const [includeAttachments, setIncludeAttachments] = useState(false);
    const [attachmentType, setAttachmentType] = useState('asEmbedded');
    const [includeAttachmentContent, setIncludeAttachmentContent] = useState(false);
    const [includeRequirements, setIncludeRequirements] = useState(false);
    const [includeCustomerId, setIncludeCustomerId] = useState(false);
    const [flatSuiteTestCases, setFlatSuiteTestCases] = useState(false);

    const [linkedMomRequest, setLinkedMomRequest] = useState(defaultLinkedMomRequest);
    const [traceAnalysisRequest, setTraceAnalysisRequest] = useState(defaultSelectedQueries);

    const UpdateDocumentRequestObject = useCallback(() => {
      let testSuiteIdList;
      let nonRecursiveTestSuiteIdList;
      if (isSuiteSpecific) {
        testSuiteIdList = [];
        nonRecursiveTestSuiteIdList = [];
        const addChildrenSuites = (suiteId) => {
          const suite = store.testSuiteList?.find((s) => s.id === suiteId);
          if (suite && !testSuiteIdList.includes(suiteId)) {
            testSuiteIdList.push(suiteId);
            const children = store.testSuiteList?.filter((child) => child.parent === suiteId);
            children.forEach((child) => addChildrenSuites(child.id));
          }
        };
        selectedTestSuites.forEach((suite) => {
          nonRecursiveTestSuiteIdList.push(suite.id);
          addChildrenSuites(suite.id);
        });
      }
      addToDocumentRequestObject(
        {
          type,
          title: contentControlTitle,
          skin,
          headingLevel: 1,
          data: {
            testPlanId: selectedTestPlan.key,
            testSuiteArray: testSuiteIdList,
            nonRecursiveTestSuiteIdList,
            includeAttachments,
            attachmentType,
            includeHardCopyRun,
            includeAttachmentContent,
            includeRequirements,
            includeCustomerId,
            traceAnalysisRequest,
            linkedMomRequest,
            flatSuiteTestCases,
          },
        },
        contentControlIndex
      );
    }, [
      isSuiteSpecific,
      addToDocumentRequestObject,
      type,
      contentControlTitle,
      skin,
      selectedTestPlan.key,
      includeAttachments,
      attachmentType,
      includeHardCopyRun,
      includeAttachmentContent,
      includeRequirements,
      includeCustomerId,
      traceAnalysisRequest,
      linkedMomRequest,
      flatSuiteTestCases,
      contentControlIndex,
      selectedTestSuites,
      store.testSuiteList,
    ]);

    useEffect(() => {
      if (editingMode === false) {
        UpdateDocumentRequestObject();
      }
    }, [
      selectedTestPlan,
      isSuiteSpecific,
      selectedTestSuites,
      includeHardCopyRun,
      includeAttachments,
      attachmentType,
      includeAttachmentContent,
      includeRequirements,
      includeCustomerId,
      traceAnalysisRequest,
      editingMode,
      flatSuiteTestCases,
      UpdateDocumentRequestObject,
    ]);

    useEffect(() => {
      let isValid = true;
      let message = '';
      if (!selectedTestPlan?.key) {
        isValid = false;
        message = 'Select a test plan';
      } else if (isSuiteSpecific && (!Array.isArray(selectedTestSuites) || selectedTestSuites.length === 0)) {
        isValid = false;
        message = 'Select at least one suite or disable suite-specific selection';
      }
      try {
        store.setValidationState(contentControlIndex, 'testContent', {
          isValid,
          message,
        });
        store.clearValidationForIndex(contentControlIndex, 'init');
      } catch {
        /* empty */
      }
      return () => {
        try {
          store.clearValidationForIndex(contentControlIndex, 'testContent');
        } catch {
          /* empty */
        }
      };
    }, [selectedTestPlan?.key, isSuiteSpecific, selectedTestSuites, store, contentControlIndex]);

    const handleTestPlanChanged = useCallback(
      async (value) => {
        await store.fetchTestSuitesList(value.key);
        setSelectedTestSuites([]);
        if (value.text) {
          const testPlanNameForFile = value.text.trim().replace(/\./g, '-').replace(/\s+/g, '_');
          store.setContextName(testPlanNameForFile);
        }
        setSelectedTestPlan(value || { key: '', text: '' });
      },
      [store]
    );

    const processTestPlanSelection = useCallback(
      async (dataToSave) => {
        const { testPlanId } = dataToSave;
        const testPlan = store.testPlansList.find((tp) => tp.id === testPlanId);
        if (!testPlan) {
          toast.warn(`Test plan with ID ${testPlanId} not found`);
          return;
        }
        await handleTestPlanChanged({ key: testPlanId, text: testPlan.name });
      },
      [store.testPlansList, handleTestPlanChanged]
    );

    const processGeneralSettings = useCallback((dataToSave) => {
      const {
        includeAttachments,
        attachmentType,
        includeHardCopyRun,
        includeAttachmentContent,
        includeRequirements,
        includeCustomerId,
        flatSuiteTestCases,
      } = dataToSave;
      setIncludeAttachments(includeAttachments);
      setAttachmentType(attachmentType);
      setIncludeHardCopyRun(includeHardCopyRun);
      setIncludeAttachmentContent(includeAttachmentContent);
      setIncludeRequirements(includeRequirements);
      setIncludeCustomerId(includeCustomerId);
      setFlatSuiteTestCases(flatSuiteTestCases);
    }, []);

    const processTraceAnalysisRequest = useCallback(
      (incoming) => {
        if (!incoming || !store.sharedQueries) return;
        const validated = { ...incoming };
        if (incoming.reqTestQuery && store.sharedQueries?.acquiredTrees?.reqTestTree) {
          const validReqTestQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.reqTestTree],
            incoming.reqTestQuery
          );
          if (!validReqTestQuery && incoming.reqTestQuery) {
            toast.warn(`Previously selected Req-Test query "${incoming.reqTestQuery.title}" not found or invalid`);
          }
          validated.reqTestQuery = validReqTestQuery;
        }
        if (incoming.testReqQuery && store.sharedQueries?.acquiredTrees?.testReqTree) {
          const validTestReqQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.testReqTree],
            incoming.testReqQuery
          );
          if (!validTestReqQuery && incoming.testReqQuery) {
            toast.warn(`Previously selected Test-Req query "${incoming.testReqQuery.title}" not found or invalid`);
          }
          validated.testReqQuery = validTestReqQuery;
        }
        setTraceAnalysisRequest(validated);
      },
      [store.sharedQueries]
    );

    const processLinkedMomRequest = useCallback(
      (incoming) => {
        if (!incoming || !store.sharedQueries) return;
        const validated = { ...incoming };
        if (incoming.linkedMomQuery && store.sharedQueries?.acquiredTrees?.linkedMomTree) {
          const validLinkedMomQuery = validateQuery(
            [store.sharedQueries.acquiredTrees.linkedMomTree],
            incoming.linkedMomQuery
          );
          if (!validLinkedMomQuery && incoming.linkedMomQuery) {
            toast.warn(`Previously selected Linked MOM query "${incoming.linkedMomQuery.title}" not found or invalid`);
          }
          validated.linkedMomQuery = validLinkedMomQuery;
        }
        setLinkedMomRequest(validated);
      },
      [store.sharedQueries]
    );

    const processTestSuiteSelections = useCallback(
      (dataToSave) => {
        const { nonRecursiveTestSuiteIdList } = dataToSave;
        const testSuiteList = store.getTestSuiteList;
        if (nonRecursiveTestSuiteIdList?.length > 0) {
          const validTestSuites = nonRecursiveTestSuiteIdList
            .map((suiteId) => testSuiteList.find((suite) => suite.id === suiteId))
            .filter(Boolean)
            .map((suite) => ({
              ...suite,
              key: suite.id,
              id: suite.id,
              text: `${suite.name} - (${suite.id})`,
            }));
          if (validTestSuites.length > 0) {
            setIsSuiteSpecific(true);
            setSelectedTestSuites(validTestSuites);
          }
        } else {
          setIsSuiteSpecific(false);
          setSelectedTestSuites([]);
        }
      },
      [store.getTestSuiteList]
    );

    const loadSavedData = useCallback(
      async (dataToSave) => {
        try {
          await processTestPlanSelection(dataToSave);
          processGeneralSettings(dataToSave);
          processTraceAnalysisRequest(dataToSave.traceAnalysisRequest);
          processLinkedMomRequest(dataToSave.linkedMomRequest);
          processTestSuiteSelections(dataToSave);
        } catch (error) {
          console.error('Error loading saved data:', error);
          toast.error(`Error loading favorite data: ${error.message}`);
        }
      },
      [
        processGeneralSettings,
        processTestPlanSelection,
        processTestSuiteSelections,
        processTraceAnalysisRequest,
        processLinkedMomRequest,
      ]
    );

    useEffect(() => {
      if (store.selectedFavorite?.dataToSave) {
        loadSavedData(store.selectedFavorite.dataToSave);
      }
    }, [loadSavedData, store.selectedFavorite]);

    useEffect(() => {
      if (!selectedTestPlan?.key) {
        setSelectedTestSuites([]);
      }
    }, [selectedTestPlan?.key]);

    const testPlanOptions = useMemo(() => {
      const plans = store.testPlansList || store.testPlanList || [];
      return plans.map((plan) => ({ key: plan.id, text: plan.name }));
    }, [store.testPlansList, store.testPlanList]);

    const suiteById = useMemo(() => {
      const map = new Map();
      (store.testSuiteList || []).forEach((suite) => map.set(suite.id, suite));
      return map;
    }, [store.testSuiteList]);

    const suiteOptions = useMemo(() => {
      if (!selectedTestPlan?.key) return [];
      return (store.testSuiteList || []).map((suite) => ({
        ...suite,
        key: suite.id,
        id: suite.id,
        text: `${suite.name} - (${suite.id})`,
      }));
    }, [selectedTestPlan?.key, store.testSuiteList]);

    const linkedMomEnabled = linkedMomRequest?.linkedMomMode && linkedMomRequest.linkedMomMode !== 'none';
    const traceAnalysisEnabled = traceAnalysisRequest?.traceAnalysisMode && traceAnalysisRequest.traceAnalysisMode !== 'none';

    const linkedMomSummary = linkedMomEnabled
      ? [
          linkedMomRequest.linkedMomMode === 'relation'
            ? 'Include related MOMs'
            : `Query: ${linkedMomRequest.linkedMomQuery?.value || 'Not selected'}`,
        ]
      : undefined;

    const traceAnalysisSummary = traceAnalysisEnabled
      ? [
          traceAnalysisRequest.traceAnalysisMode === 'linkedRequirement'
            ? 'Requirements from linked trace'
            : 'Requirements from queries',
          traceAnalysisRequest.includeCommonColumnsMode !== 'both'
            ? `Common columns: ${traceAnalysisRequest.includeCommonColumnsMode}`
            : null,
        ].filter(Boolean)
      : undefined;

    return (
      <Stack spacing={1.5}>
        <SectionCard
          title='Test Plan and Suites'
          description='Choose a test plan and optionally limit the suites included in the document.'
        >
          <Stack spacing={1.25}>
            <SmartAutocomplete
              disableClearable
              autoHighlight
              openOnFocus
              options={testPlanOptions}
              label='Test Plan'
              value={selectedTestPlan}
              onChange={async (_event, newValue) => {
                if (!newValue) {
                  setSelectedTestPlan({ key: '', text: '' });
                  setSelectedTestSuites([]);
                  return;
                }
                await handleTestPlanChanged(newValue);
              }}
            />
            <Stack spacing={0.75}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isSuiteSpecific}
                    onChange={(_event, checked) => setIsSuiteSpecific(checked)}
                  />
                }
                label='Limit to specific suites'
              />
              {isSuiteSpecific ? (
                <SmartAutocomplete
                  multiple
                  disableCloseOnSelect
                  autoHighlight
                  openOnFocus
                  showCheckbox
                  options={suiteOptions}
                  groupBy={(option) => {
                    const parent = suiteById.get(option.parent);
                    return parent ? `Parent: ${parent.name}` : 'Top Level';
                  }}
                  label='Suites'
                  textFieldProps={{
                    helperText: selectedTestPlan?.key
                      ? 'Descendants are automatically included'
                      : 'Select a test plan first',
                  }}
                  value={selectedTestSuites}
                  onChange={(_event, newValue) => {
                    setSelectedTestSuites(newValue || []);
                  }}
                />
              ) : null}
            </Stack>
            <Divider flexItem />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems='flex-start'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeHardCopyRun}
                    onChange={(_event, checked) => setIncludeHardCopyRun(checked)}
                  />
                }
                label='Generate manual hard copy run'
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={flatSuiteTestCases}
                    onChange={(_event, checked) => setFlatSuiteTestCases(checked)}
                  />
                }
                label='Flatten single-suite test cases'
              />
            </Stack>
          </Stack>
        </SectionCard>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 8 }}>
            <SectionCard
              title='Automation Queries'
              description='Configure linked MOM and trace analysis queries to enrich the output.'
              compact
            >
              <Stack spacing={1.25}>
                <SettingsDisplay
                  title='Linked MOM'
                  settings={linkedMomSummary || []}
                  emptyMessage='Use linked relations or queries to pull MOM data.'
                  actions={
                    <LinkedMomDialog
                      store={store}
                      sharedQueries={store.sharedQueries}
                      prevLinkedMomRequest={linkedMomRequest}
                      onLinkedMomChange={setLinkedMomRequest}
                    />
                  }
                />

                <SettingsDisplay
                  title='Trace Analysis'
                  settings={traceAnalysisSummary || []}
                  emptyMessage='Pull requirements traceability based on linked items or queries.'
                  actions={
                    <TraceAnalysisDialog
                      store={store}
                      sharedQueries={store.sharedQueries}
                      prevTraceAnalysisRequest={traceAnalysisRequest}
                      onTraceAnalysisChange={setTraceAnalysisRequest}
                    />
                  }
                />
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1.5}>
              <SectionCard
                title='Attachments'
                compact
                enableToggle='Enable'
                enabled={includeAttachments}
                onToggle={(_event, checked) => setIncludeAttachments(checked)}
              >
                {includeAttachments ? (
                  <Stack spacing={1.25}>
                    <FormLabel>Attachment type</FormLabel>
                    <RadioGroup value={attachmentType} onChange={(_event, value) => setAttachmentType(value)}>
                      <FormControlLabel value='asEmbedded' control={<Radio />} label='Embed attachments' />
                      <FormControlLabel value='asLinked' control={<Radio />} label='Link attachments' />
                    </RadioGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeAttachmentContent}
                          onChange={(_event, checked) => setIncludeAttachmentContent(checked)}
                        />
                      }
                      label='Include attachment contents'
                    />
                  </Stack>
                ) : (
                  <Typography variant='body2' color='text.secondary'>Attachments will be skipped.</Typography>
                )}
              </SectionCard>

              <SectionCard
                title='Requirements'
                compact
                enableToggle='Enable'
                enabled={includeRequirements}
                onToggle={(_event, checked) => {
                  setIncludeRequirements(checked);
                  if (!checked) setIncludeCustomerId(false);
                }}
              >
                {includeRequirements ? (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeCustomerId}
                        onChange={(_event, checked) => setIncludeCustomerId(checked)}
                      />
                    }
                    label='Include customer ID'
                  />
                ) : (
                  <Typography variant='body2' color='text.secondary'>Requirements will be omitted.</Typography>
                )}
              </SectionCard>
            </Stack>
          </Grid>
        </Grid>

        {editingMode ? (
          <Box>
            <Button variant='contained' onClick={UpdateDocumentRequestObject}>
              Add Content To Document
            </Button>
          </Box>
        ) : null}
      </Stack>
    );
  }
);

export default TestContentSelector;
