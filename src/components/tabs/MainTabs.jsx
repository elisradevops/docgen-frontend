import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import { useCookies } from 'react-cookie';

import DeveloperForm from '../forms/develeoperForm/DeveloperForm';
import DocFormGenerator from '../forms/docFormGenerator/DocFormGenerator';
import DocumentsTab from '../forms/documentsTab/DocumentsTab';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import { styled, alpha, keyframes } from '@mui/material/styles';
import {
  Box,
  Grid,
  IconButton,
  Tooltip,
  Backdrop,
  CircularProgress,
  Typography,
  Drawer,
  Fab,
  Stack,
  Paper,
} from '@mui/material';
import SmartAutocomplete from '../common/SmartAutocomplete';
import STRGuide from '../common/guides/STRGuide';
import STDGuide from '../common/guides/STDGuide';
import SVDGuide from '../common/guides/SVDGuide';
import SRSGuide from '../common/guides/SRSGuide';
import TemplatesTab from '../forms/templatesTab/TemplatesTab';
import ClearIcon from '@mui/icons-material/Clear';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CloseIcon from '@mui/icons-material/Close';
import FormattingSettingsDialog from '../dialogs/FormattingSettingsDialog';
import { SyncOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import AppLayout from '../layout/AppLayout';
import ActionBar from '../layout/ActionBar';
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined';
import TemplateFileSelectDialog from '../dialogs/TemplateFileSelectDialog';
import FavoriteDialog from '../dialogs/FavoriteDialog';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { isAccessToken } from '../../utils/tokenUtils';

const defaultItem = { key: '', text: '' };
const StyledTabs = styled((props) => (
  <Tabs
    {...props}
    TabIndicatorProps={{ children: <span className='MuiTabs-indicatorSpan' /> }}
  />
))(({ theme }) => ({
  '& .MuiTabs-indicator': {
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  '& .MuiTabs-indicatorSpan': {
    maxWidth: 48,
    width: '100%',
    height: 4,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.secondary.main,
  },
}));

const StyledTab = styled((props) => (
  <Tab
    disableRipple
    {...props}
  />
))(({ theme }) => ({
  textTransform: 'none',
  fontWeight: theme.typography.fontWeightRegular,
  fontSize: theme.typography.pxToRem(15),
  marginRight: theme.spacing(1),
  color: 'rgba(255, 255, 255, 0.7)',
  '&.Mui-selected': {
    color: '#fff',
  },
  '&.Mui-focusVisible': {
    backgroundColor: 'rgba(100, 95, 228, 0.32)',
  },
}));

const StyledLogoutButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(theme.palette.error.main),
  backgroundColor: theme.palette.error.main,
  '&:hover': {
    backgroundColor: theme.palette.error.dark,
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(theme.palette.secondary.main),
  backgroundColor: theme.palette.secondary.main,
  '&:hover': {
    backgroundColor: theme.palette.secondary.dark,
  },
}));

const bootPulse = keyframes`
  0%, 70%, 100% {
    transform: scale(0.85);
    opacity: 0.55;
  }
  35% {
    transform: scale(1);
    opacity: 1;
  }
`;

const bootSweep = keyframes`
  0% {
    transform: translateX(-60%);
    opacity: 0.1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translateX(60%);
    opacity: 0.2;
  }
`;

const shouldDebugLogs = () => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('debug');
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
};

const normalizeProjectName = (value) => {
  let raw = String(value || '').trim();
  if (!raw) return '';
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(raw)) break;
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded === raw) break;
      raw = decoded;
    } catch {
      break;
    }
  }
  raw = raw.replace(/[\u00a0\u200b\u200c\u200d\uFEFF]/g, ' ');
  raw = raw.replace(/\s+/g, ' ').trim();
  return raw;
};

// Centralized tab identifiers to avoid collisions
const TAB_DOCS = 'docs';
const TAB_TEMPLATES = 'templates';
const TAB_DEVELOPER = 'developer';

const MainTabs = observer(({ store, adoContext }) => {
  const [selectedTab, setSelectedTab] = useState(TAB_DOCS);
  // eslint-disable-next-line no-unused-vars
  const [cookies, setCookie, removeCookie] = useCookies(['azureDevopsUrl', 'azureDevopsPat']);
  const [selectedTeamProject, setSelectedTeamProject] = useState(defaultItem);
  const [projectClearable, setProjectClearable] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const isAdoMode = !!adoContext?.isAdo;
  const adoProjectId = adoContext?.project?.id || '';
  const adoProjectName = adoContext?.project?.name || '';
  const normalizedAdoProjectName = normalizeProjectName(adoProjectName);
  const adoBootStatus = store.adoBootStatus;
  const adoBootError = store.adoBootError;
  const adoBooting = isAdoMode && adoBootStatus !== 'ready';
  const debugEnabled = useMemo(() => shouldDebugLogs(), []);
  const isAdoAccessToken = useMemo(() => isAccessToken(store.adoToken), [store.adoToken]);
  const adoProjectItem =
    adoContext?.project?.id && normalizedAdoProjectName
      ? { key: adoContext.project.id, text: normalizedAdoProjectName }
      : null;
  // Track the initial tabs loading phase (document types fetch). We only show the loading screen for the first load
  const [tabsLoadedOnce, setTabsLoadedOnce] = useState(false);
  // Track if the user has manually changed tabs before the initial load completes
  const [tabManuallyChanged, setTabManuallyChanged] = useState(false);
  const logout = useCallback(() => {
    if (isAdoMode) return;
    removeCookie('azureDevopsUrl', { path: '/' });
    removeCookie('azureDevopsPat', { path: '/' });
  }, [isAdoMode, removeCookie]);

  useEffect(() => {
    if (isAdoMode) {
      if (!isAdoAccessToken) {
        (async () => {
          await store.fetchUserDetails();
        })();
      }
      return;
    }
    if (cookies.azureDevopsUrl && cookies.azureDevopsPat) {
      (async () => {
        const ok = await store.fetchUserDetails();
        if (!ok) {
          if (store.lastAuthErrorStatus === 401) {
            toast.error('Session expired or invalid PAT. Please sign in again.');
            logout();
          } else if (store.lastAuthErrorStatus) {
            toast.error(`Authentication check failed (${store.lastAuthErrorStatus}).`);
          }
        }
      })();
    }
  }, [cookies, isAdoMode, isAdoAccessToken, logout, store]);

  // Global 401 handling via browser event dispatched from DataStore handler
  useEffect(() => {
    const onUnauthorized = () => {
      toast.error('Your session has expired (401). Please sign in again.');
      if (!isAdoMode) {
        logout();
      }
    };
    window.addEventListener('auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', onUnauthorized);
  }, [isAdoMode, logout]);

  useEffect(() => {
    if (!isAdoMode) return;
    if (!normalizedAdoProjectName) return;
    const projectKey = adoProjectId || '';
    if (debugEnabled) {
      console.debug('[ado] MainTabs project context', {
        adoProjectId,
        adoProjectName,
        normalizedAdoProjectName,
        projectKey,
        storeTeamProject: store.teamProject,
        adoBootStatus,
      });
    }
    setSelectedTeamProject({ key: projectKey || normalizedAdoProjectName, text: normalizedAdoProjectName });
    if (projectKey) {
      if (store.teamProject !== projectKey || store.adoBootStatus === 'idle') {
        store.setTeamProject(projectKey, normalizedAdoProjectName);
      }
    } else {
      if (store.adoBootStatus === 'idle' && !store.adoProjectResolveInFlight) {
        store.resolveTeamProjectByName(normalizedAdoProjectName);
      }
    }
    setProjectClearable(false);
  }, [
    adoProjectItem?.key,
    adoProjectItem?.text,
    adoProjectId,
    adoProjectName,
    normalizedAdoProjectName,
    isAdoMode,
    store,
    store.teamProject,
    store.adoBootStatus,
    store.adoProjectResolveInFlight,
    debugEnabled,
  ]);

  // Keep selected tab in sync with available document types
  // Note: Do not override manual selection of special tabs (Docs/Templates/Developer).
  useEffect(() => {
    const types = store.documentTypes || [];
    const isSpecial = [TAB_DOCS, TAB_TEMPLATES, TAB_DEVELOPER].includes(selectedTab);
    if (types.length > 0) {
      // If the current selection is not a special tab and not a valid doc type, default to the first doc type
      if (!isSpecial && !types.includes(selectedTab)) {
        setSelectedTab(types[0]);
      }
    } else {
      // If no doc types are available and the current selection is a doc type, fall back to Docs tab
      if (!isSpecial) {
        setSelectedTab(TAB_DOCS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.documentTypes]);

  // Auto-select the first doc type after the initial tab list finishes loading.
  // Also notify via toast if tabs failed to load (no doc types after load completes).
  useEffect(() => {
    if (adoBooting) return;
    const loading = !!store.loadingState?.contentControlsLoadingState;
    const types = store.documentTypes || [];
    if (!tabsLoadedOnce && !loading) {
      if (types.length > 0) {
        // Only auto-select if user hasn't manually changed tabs and we're still on the default Docs tab
        if (!tabManuallyChanged && selectedTab === TAB_DOCS) {
          setSelectedTab(types[0]);
          setProjectClearable(false);
        }
      } else {
        toast.error('Failed to load document type tabs. Please try refreshing.');
      }
      setTabsLoadedOnce(true);
    }
  }, [
    store.loadingState?.contentControlsLoadingState,
    store.documentTypes,
    selectedTab,
    tabsLoadedOnce,
    tabManuallyChanged,
    adoBooting,
  ]);

  // Derive syncing state from store loading flags
  const syncing =
    selectedTab === TAB_DOCS
      ? store.loadingState?.documentsLoadingState
      : selectedTab === TAB_TEMPLATES
      ? store.loadingState?.templatesLoadingState
      : false;

  const isProjectSelected = Boolean(selectedTeamProject?.key && selectedTeamProject?.text);
  const isDocTypeTab = Array.isArray(store.documentTypes) && store.documentTypes.includes(selectedTab);
  const currentHasGuide = isDocTypeTab && generateGuide(selectedTab) !== null;

  function generateGuide(docType) {
    switch (docType) {
      case 'STD':
        return <STDGuide />;
      case 'STR':
        return <STRGuide />;
      case 'SVD':
        return <SVDGuide />;
      case 'SRS':
        return <SRSGuide />;
      default:
        return null;
    }
  }

  const handleSync = () => {
    if (adoBooting) return;
    // Re-apply the currently selected project to trigger store loaders
    if (selectedTeamProject?.key && selectedTeamProject?.text) {
      store.setTeamProject(selectedTeamProject.key, selectedTeamProject.text);
    }

    // Additionally refresh according to the active tab
    if (selectedTab === TAB_DOCS) {
      // Documents tab
      store.fetchDocuments();
    } else if (selectedTab === TAB_TEMPLATES) {
      // Templates tab
      try {
        // Let TemplatesTab decide which library (project/shared) to refresh
        window.dispatchEvent(new CustomEvent('docgen:templates-refresh'));
      } catch {
        store.fetchTemplatesListForDownload();
      }
    }
  };

  const navigation = (
    <StyledTabs
      value={selectedTab}
      onChange={(event, newValue) => {
        if (adoBooting) return;
        setTabManuallyChanged(true);
        setSelectedTab(newValue);
        // Check if the selected tab is the templates tab
        setProjectClearable(newValue === TAB_TEMPLATES);
      }}
      aria-label='document tabs'
    >
      {store.documentTypes.map((docType) => {
        return (
          <StyledTab
            key={`doctype-tab-${docType}`}
            label={docType}
            value={docType}
          />
        );
      })}
      <StyledTab
        label='Documents'
        value={TAB_DOCS}
      />
      <StyledTab
        label='Templates'
        value={TAB_TEMPLATES}
      />
      {/* Keep MUI Tabs value valid when using the Developer button */}
      <StyledTab
        label='Developer'
        value={TAB_DEVELOPER}
        // Must not be `display: none` or removed from layout; MUI measures the selected tab.
        sx={{
          visibility: 'hidden',
          minWidth: 0,
          width: 0,
          maxWidth: 0,
          p: 0,
          m: 0,
        }}
      />
    </StyledTabs>
  );

  const headerActions = isAdoMode ? null : (
    <>
      <StyledButton
        startIcon={<DeveloperModeIcon />}
        onClick={() => {
          setTabManuallyChanged(true);
          setSelectedTab(TAB_DEVELOPER);
          setProjectClearable(false);
        }}
      >
        Developer
      </StyledButton>
      <StyledLogoutButton onClick={logout}>Logout</StyledLogoutButton>
    </>
  );

  const selectedTemplateInfo = store.selectedTemplate;
  const isTestReporterTab = (selectedTab || '').toLowerCase() === 'test-reporter';
  const showDocControls = isDocTypeTab && !adoBooting;

  const filterControls = (
    <Box
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: showDocControls
          ? { xs: '1fr', md: 'minmax(260px, 3.5fr) minmax(0, 8.5fr)' }
          : '1fr',
        columnGap: { md: 2.5 },
        rowGap: { xs: 1.25, md: 1.5 },
        alignItems: 'stretch',
        mt: { xs: 0, md: 0.25 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.5 },
          gridColumn: '1 / 2',
          gridRow: '1 / 2',
        }}
      >
        {isAdoMode ? (
          <Paper
            variant='outlined'
            sx={{
              width: { xs: '100%', sm: 300, md: 340 },
              px: 2,
              py: 1.5,
              borderRadius: 2,
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(
                  theme.palette.secondary.main,
                  0.12
                )})`,
            }}
          >
            <Stack
              direction='row'
              alignItems='center'
              spacing={1.25}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18),
                  color: 'primary.main',
                }}
              >
                <AccountTreeOutlinedIcon fontSize='small' />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
                >
                  Azure DevOps Project
                </Typography>
                <Typography
                  variant='subtitle1'
                  sx={{ fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden' }}
                >
                  {normalizedAdoProjectName || 'Unknown project'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ) : (
          <SmartAutocomplete
            disableClearable
            sx={{ width: { xs: '100%', sm: 260, md: 300 } }}
            autoHighlight
            openOnFocus
            loading={store.loadingState.teamProjectsLoadingState}
            disabled={isAdoMode}
            options={store.teamProjectsList.map((teamProject) => ({
              key: teamProject.id,
              text: teamProject.name,
            }))}
            label='Team Project'
            placeholder={
              store.loadingState.teamProjectsLoadingState ? 'Loading projects…' : 'Start typing to search'
            }
            value={selectedTeamProject?.key ? selectedTeamProject : null}
            onChange={async (_e, newValue) => {
              if (isAdoMode) return;
              const nextValue = newValue || defaultItem;
              setSelectedTeamProject(nextValue);
              store.setTeamProject(nextValue.key || '', nextValue.text || '');
              // Clear selected template so defaults can be re-evaluated for the new project
              store.setSelectedTemplate(null);
            }}
          />
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.25 },
          }}
        >
          {selectedTab !== TAB_DOCS && selectedTab !== TAB_TEMPLATES ? (
            <>
              <FormattingSettingsDialog store={store} />
              <Tooltip title='Clear selection' placement='top'>
                <span>
                  <IconButton
                    aria-label='clear-tab-selection'
                    color='error'
                    size='small'
                    onClick={() => {
                      try {
                        // Clear session storage entries for this docType in current project
                        store.clearDocTypeTabSessionState(selectedTab);
                      } catch {
                        /* empty */
                      }
                      try {
                        // Broadcast a clear event for all selectors in this tab to reset local state
                        const ev = `docgen:clear-tab:${selectedTab}`;
                        window.dispatchEvent(new CustomEvent(ev));
                      } catch {
                        /* empty */
                      }
                    }}
                    disabled={!isProjectSelected}
                  >
                    <CleaningServicesOutlinedIcon fontSize='small' />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          ) : (
            <Tooltip
              title={
                syncing ? 'Syncing…' : !isProjectSelected ? 'Select a TeamProject' : 'Refresh from Azure'
              }
              placement='top'
            >
              <span>
                <IconButton
                  aria-label='sync'
                  color='info'
                  onClick={handleSync}
                  disabled={syncing || !isProjectSelected || adoBooting}
                  size='small'
                >
                  <SyncOutlined spin={syncing} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {projectClearable && !isAdoMode ? (
            <Tooltip
              title='Clear the selected TeamProject (optional)'
              placement='top'
            >
              <Button
                variant='outlined'
                color='inherit'
                startIcon={<ClearIcon />}
                onClick={() => {
                  setSelectedTeamProject(defaultItem);
                  store.setTeamProject('', '');
                  store.setSelectedTemplate(null);
                }}
              >
                Clear
              </Button>
            </Tooltip>
          ) : null}
        </Box>
      </Box>
      {showDocControls ? (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: { xs: 1, sm: 1.25 },
              gridColumn: '1 / 2',
              gridRow: { xs: 'auto', md: '2 / 3' },
            }}
          >
            {!isTestReporterTab ? (
              <TemplateFileSelectDialog
                store={store}
                docType={selectedTab}
                selectedTeamProject={selectedTeamProject.text}
                selectedTemplate={selectedTemplateInfo}
                setSelectedTemplate={(template) => store.setSelectedTemplate(template)}
              />
            ) : null}
            <FavoriteDialog
              isDisabled={!selectedTemplateInfo && (selectedTab || '').toLowerCase() !== 'test-reporter'}
              store={store}
              docType={selectedTab}
              selectedTeamProject={selectedTeamProject.text}
            />
          </Box>
          {selectedTemplateInfo ? (
            <Paper
              variant='outlined'
              sx={{
                gridColumn: { xs: '1 / 2', md: '2 / 3' },
                gridRow: { xs: 'auto', md: '1 / 3' },
                width: '100%',
                px: { xs: 1.75, md: 2.25 },
                py: 1.5,
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 1.5,
                borderRadius: 2.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
              }}
            >
              <DocumentScannerOutlinedIcon
                color='primary'
                sx={{ fontSize: 30, mt: { xs: 0.25, sm: 0 } }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant='subtitle1'
                  sx={{ fontWeight: 600 }}
                  color='primary.main'
                >
                  Selected Template
                </Typography>
                <Typography
                  variant='h6'
                  sx={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden' }}
                >
                  {selectedTemplateInfo?.text?.split('/')?.pop()}
                </Typography>
                {selectedTemplateInfo?.text && selectedTemplateInfo.text.includes('/') ? (
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}
                  >
                    {selectedTemplateInfo.text}
                  </Typography>
                ) : null}
              </Box>
            </Paper>
          ) : null}
        </>
      ) : null}
    </Box>
  );

  const friendlyTabName = (() => {
    if (isDocTypeTab) return `${selectedTab} Documents`;
    if (selectedTab === TAB_DOCS) return 'Documents';
    if (selectedTab === TAB_TEMPLATES) return 'Templates';
    if (selectedTab === TAB_DEVELOPER) return 'Developer Tools';
    return selectedTab;
  })();

  const contextSummary = null;

  const guideToggle = currentHasGuide && (
    <Tooltip
      title={guideOpen ? 'Close Guide' : 'Open Guide'}
      placement='left'
    >
      <Fab
        onClick={() => setGuideOpen(!guideOpen)}
        size='large'
        color={guideOpen ? 'secondary' : 'warning'}
        sx={{
          position: 'fixed',
          bottom: { xs: 32, md: 48 },
          right: { xs: 28, md: 48 },
          width: { xs: 72, md: 80 },
          height: { xs: 72, md: 80 },
          boxShadow: (theme) => theme.shadows[10],
          borderRadius: '50%',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          zIndex: 1000, // Ensure it's above footer in Edge 92
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '2rem', md: '2.25rem' },
          },
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: (theme) => theme.shadows[16],
          },
        }}
      >
        {guideOpen ? <CloseIcon /> : <MenuBookIcon />}
      </Fab>
    </Tooltip>
  );

  const isDeveloperTab = selectedTab === TAB_DEVELOPER;

  if (adoBooting) {
    const bootTitle =
      adoBootStatus === 'error' ? 'Unable to initialize Azure DevOps data' : 'Preparing Azure DevOps data';
    const bootSubtitle =
      adoBootStatus === 'idle'
        ? 'Waiting for Azure DevOps context...'
        : !store.teamProject
        ? 'Resolving project identity...'
        : 'Loading profile, project metadata, and permissions...';
    return (
      <AppLayout
        navigation={navigation}
        actions={headerActions}
      >
        <Box
          role='status'
          aria-live='polite'
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: (theme) => theme.zIndex.modal + 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => theme.palette.background.default,
            background: (theme) =>
              `radial-gradient(1200px 600px at 20% 10%, ${alpha(
                theme.palette.primary.main,
                0.12
              )}, transparent 60%), radial-gradient(900px 480px at 80% 20%, ${alpha(
                theme.palette.secondary.main,
                0.14
              )}, transparent 60%)`,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.4,
              backgroundImage:
                'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              pointerEvents: 'none',
            }}
          />
          <Paper
            elevation={0}
            sx={{
              position: 'relative',
              zIndex: 1,
              width: 'min(560px, 90vw)',
              px: { xs: 3, md: 4.5 },
              py: { xs: 3.5, md: 4.5 },
              borderRadius: 3,
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
              background: (theme) =>
                `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.9)}, ${alpha(
                  theme.palette.background.paper,
                  0.95
                )})`,
              boxShadow: (theme) => theme.shadows[6],
            }}
          >
            <Stack
              spacing={2}
              alignItems='center'
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                }}
              >
                {[0, 1, 2].map((idx) => (
                  <Box
                    key={`boot-dot-${idx}`}
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: (theme) =>
                        idx === 1 ? theme.palette.secondary.main : theme.palette.primary.main,
                      animation: `${bootPulse} 1.2s ease-in-out ${idx * 0.2}s infinite`,
                    }}
                  />
                ))}
              </Box>
              <Typography
                variant='overline'
                sx={{ letterSpacing: 2, color: 'text.secondary' }}
              >
                Azure DevOps Bootstrap
              </Typography>
              <Typography
                variant='h6'
                sx={{ fontWeight: 700 }}
              >
                {bootTitle}
              </Typography>
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{ textAlign: 'center', maxWidth: 420 }}
              >
                {bootSubtitle}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 6,
                  borderRadius: 999,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '60%',
                    mx: 'auto',
                    borderRadius: 999,
                    background: (theme) =>
                      `linear-gradient(90deg, transparent, ${alpha(
                        theme.palette.primary.main,
                        0.6
                      )}, transparent)`,
                    animation: `${bootSweep} 1.6s ease-in-out infinite`,
                  }}
                />
              </Box>
              {adoBootError ? (
                <Typography
                  variant='body2'
                  color='error'
                  sx={{ fontWeight: 600, textAlign: 'center' }}
                >
                  {adoBootError}
                </Typography>
              ) : null}
              {adoBootStatus === 'error' ? (
                <Button
                  variant='contained'
                  onClick={() => {
                    if (!store.teamProject && normalizedAdoProjectName) {
                      store.resolveTeamProjectByName(normalizedAdoProjectName);
                      return;
                    }
                    store.bootstrapAdoProjectData();
                  }}
                  disabled={!store.teamProject && !normalizedAdoProjectName}
                >
                  Retry
                </Button>
              ) : null}
            </Stack>
          </Paper>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      navigation={navigation}
      actions={headerActions}
    >
      <Stack
        spacing={2}
        sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <ActionBar
          start={contextSummary}
          end={filterControls}
        />

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            height: isDeveloperTab ? 'auto' : '100%',
            overflowY: isDeveloperTab ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        >
          <Grid
            container
            spacing={2}
            sx={{
              height: isDeveloperTab ? 'auto' : '100%',
              m: 0,
              width: '100%',
              overflow: isDeveloperTab ? 'visible' : 'hidden',
            }}
          >
            {store.documentTypes.map((docType) => {
              return selectedTab === docType ? (
                <Grid
                  key={`doctype-content-${docType}`}
                  size={12}
                  sx={{ height: '100%' }}
                >
                  <DocFormGenerator
                    docType={docType}
                    store={store}
                    selectedTeamProject={selectedTeamProject.text}
                  />
                </Grid>
              ) : null;
            })}
            {selectedTab === TAB_DEVELOPER ? (
              <Grid
                size={12}
                sx={{
                  height: 'auto',
                  overflow: 'visible',
                }}
              >
                <DeveloperForm store={store} />
              </Grid>
            ) : null}
            {selectedTab === TAB_DOCS ? (
              <Grid
                size={12}
                sx={{ height: '100%' }}
              >
                <DocumentsTab
                  store={store}
                  selectedTeamProject={selectedTeamProject}
                />
              </Grid>
            ) : null}
            {selectedTab === TAB_TEMPLATES ? (
              <Grid
                size={12}
                sx={{ height: '100%' }}
              >
                <TemplatesTab
                  store={store}
                  selectedTeamProject={selectedTeamProject}
                />
              </Grid>
            ) : null}
          </Grid>
        </Box>
      </Stack>
      {guideToggle}
      {/* Right-side Guide Drawer */}
      <Drawer
        anchor='right'
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420, md: 520 },
            bgcolor: (theme) => theme.palette.background.default,
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            display: 'flex',
          },
        }}
      >
        <Stack
          spacing={0}
          sx={{ width: '100%', height: '100%' }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2,
              borderBottom: 1,
              borderColor: 'divider',
              gap: 1,
            }}
          >
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Guide
              </Typography>
              <Typography variant='h6'>{friendlyTabName}</Typography>
            </Box>
            <IconButton
              onClick={() => setGuideOpen(false)}
              aria-label='close guide'
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 3,
              py: 2,
            }}
          >
            {isDocTypeTab ? (
              generateGuide(selectedTab)
            ) : (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Select a document tab to view contextual guidance.
              </Typography>
            )}
          </Box>
        </Stack>
      </Drawer>
      {/* Initial tabs loading overlay */}
      <Backdrop
        open={!tabsLoadedOnce && !!store.loadingState?.contentControlsLoadingState}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress color='inherit' />
          <Typography variant='body1'>Loading tabs…</Typography>
        </Box>
      </Backdrop>
    </AppLayout>
  );
});

export default MainTabs;
