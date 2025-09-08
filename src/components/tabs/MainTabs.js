import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { useCookies } from 'react-cookie';

import DeveloperForm from '../forms/develeoperForm/DeveloperForm';
import DocFormGenerator from '../forms/docFormGenerator/DocFormGenerator';
import DocumentsTab from '../forms/documentsTab/DocumentsTab';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import AppBar from '@mui/material/AppBar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import { Box, Grid, IconButton, Tooltip } from '@mui/material';
import SmartAutocomplete from '../common/SmartAutocomplete';
import STRGuide from '../common/STRGuide';
import STDGuide from '../common/STDGuide';
import SVDGuide from '../common/SVDGuide';
import SRSGuide from '../common/SRSGuide';
import TemplatesTab from '../forms/templatesTab/TemplatesTab';
import ClearIcon from '@mui/icons-material/Clear';
import { indigo } from '@mui/material/colors';
import FormattingSettingsDialog from '../dialogs/FormattingSettingsDialog';
import { SyncOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';

const defaultItem = { key: '', text: '' };
const StyledTabs = styled((props) => (
  <Tabs
    {...props}
    TabIndicatorProps={{ children: <span className='MuiTabs-indicatorSpan' /> }}
  />
))({
  '& .MuiTabs-indicator': {
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  '& .MuiTabs-indicatorSpan': {
    maxWidth: 40,
    width: '100%',
    backgroundColor: 'red',
  },
});

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
  color: 'white',
  backgroundColor: 'red',
  '&:hover': {
    backgroundColor: 'darkred',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(indigo[500]),
  backgroundColor: indigo[500],
  '&:hover': {
    backgroundColor: 'indigo[700]',
  },
}));

// Centralized tab identifiers to avoid collisions
const TAB_DOCS = 'docs';
const TAB_TEMPLATES = 'templates';
const TAB_DEVELOPER = 'developer';

const MainTabs = observer(({ store }) => {
  const [selectedTab, setSelectedTab] = useState(TAB_DOCS);
  const [cookies, setCookie, removeCookie] = useCookies(['azuredevopsUrl', 'azuredevopsPat']);
  const [selectedTeamProject, setSelectedTeamProject] = useState(defaultItem);
  const [projectClearable, setProjectClearable] = useState(false);
  const logout = () => {
    removeCookie('azuredevopsUrl', { path: '/' });
    removeCookie('azuredevopsPat', { path: '/' });
  };

  useEffect(() => {
    if (cookies.azuredevopsUrl && cookies.azuredevopsPat) {
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
  }, [cookies]);

  // Global 401 handling via browser event dispatched from DataStore handler
  useEffect(() => {
    const onUnauthorized = () => {
      toast.error('Your session has expired (401). Please sign in again.');
      logout();
    };
    window.addEventListener('auth-unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', onUnauthorized);
  }, []);

  // Keep selected tab in sync with available document types
  useEffect(() => {
    const types = store.documentTypes || [];
    const isSpecial = [TAB_DOCS, TAB_TEMPLATES, TAB_DEVELOPER].includes(selectedTab);
    if (types.length > 0) {
      // Previous behavior: default to the first doc type when types are available
      if (isSpecial || (!isSpecial && !types.includes(selectedTab))) {
        setSelectedTab(types[0]);
      }
    } else {
      // If no doc types visible and we were on a doc type, fall back to Docs tab
      if (!isSpecial) {
        setSelectedTab(TAB_DOCS);
      }
    }
  }, [store.documentTypes]);

  // Derive syncing state from store loading flags
  const syncing =
    selectedTab === TAB_DOCS
      ? store.loadingState?.documentsLoadingState
      : selectedTab === TAB_TEMPLATES
      ? store.loadingState?.templatesLoadingState
      : false;

  const isProjectSelected = Boolean(selectedTeamProject?.key && selectedTeamProject?.text);

  const generateGuide = (docType) => {
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
  };

  const handleSync = () => {
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
      store.fetchTemplatesListForDownload();
    }
  };

  return (
    <div>
      <AppBar position='static'>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <StyledTabs
            value={selectedTab}
            onChange={(event, newValue) => {
              setSelectedTab(newValue);
              // Check if the selected tab is the templates tab
              setProjectClearable(newValue === TAB_TEMPLATES);
            }}
            aria-label='document tabs'
          >
            {store.documentTypes.map((docType, key) => {
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
          </StyledTabs>
          <Box
            gap={1}
            px={1}
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <StyledButton
              startIcon={<DeveloperModeIcon />}
              onClick={() => {
                setSelectedTab(TAB_DEVELOPER);
                setProjectClearable(false);
              }}
            >
              Developer
            </StyledButton>
            <StyledLogoutButton onClick={logout}>Logout</StyledLogoutButton>
          </Box>
        </Box>
      </AppBar>
      <Grid container>
        <Grid
          item
          xs={12}
        >
          <Grid
            container
            justifyContent='center'
            alignItems='start'
          >
            <Grid
              item
              xs={12}
              sx={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', alignItems: 'center' }}
            >
              <SmartAutocomplete
                disableClearable
                style={{ marginBlock: 8, width: 300 }}
                autoHighlight
                openOnFocus
                loading={store.loadingState.teamProjectsLoadingState}
                options={store.teamProjectsList.map((teamProject) => ({
                  key: teamProject.id,
                  text: teamProject.name,
                }))}
                label='Select a TeamProject'
                value={selectedTeamProject}
                onChange={async (_e, newValue) => {
                  setSelectedTeamProject(newValue || defaultItem);
                  store.setTeamProject(newValue?.key || '', newValue?.text || '');
                  // Clear selected template so defaults can be re-evaluated for the new project
                  store.setSelectedTemplate(null);
                }}
              />
              {selectedTab !== TAB_DOCS && selectedTab !== TAB_TEMPLATES ? (
                <FormattingSettingsDialog store={store} />
              ) : (
                <Tooltip
                  title={syncing ? 'Syncing…' : !isProjectSelected ? 'Select a TeamProject' : 'Sync'}
                  placement='top'
                >
                  <IconButton
                    aria-label='sync'
                    color='info'
                    onClick={handleSync}
                    disabled={syncing || !isProjectSelected}
                    size='small'
                  >
                    <SyncOutlined spin={syncing} />
                  </IconButton>
                </Tooltip>
              )}
              {projectClearable && (
                <Tooltip
                  title='Clear the selected TeamProject to view all shared templates'
                  placement='right'
                >
                  <Button
                    style={{ marginBlock: 8 }}
                    variant='outlined'
                    color='error'
                    startIcon={<ClearIcon />}
                    onClick={() => {
                      setSelectedTeamProject(defaultItem);
                      store.setTeamProject('', '');
                      // Also clear any selected template when clearing the project
                      store.setSelectedTemplate(null);
                    }}
                  >
                    Clear
                  </Button>
                </Tooltip>
              )}
            </Grid>
          </Grid>
        </Grid>

        {store.documentTypes.map((docType, key) => {
          const hasGuide = generateGuide(docType) !== null;
          return selectedTab === docType ? (
            <>
              <Grid
                item
                xs={hasGuide ? 3 : 12}
              >
                <DocFormGenerator
                  docType={docType}
                  store={store}
                  selectedTeamProject={selectedTeamProject.text}
                />
              </Grid>
              {hasGuide && (
                <Grid
                  item
                  xs={9}
                >
                  {generateGuide(docType)}
                </Grid>
              )}
            </>
          ) : null;
        })}
        {selectedTab === TAB_DEVELOPER ? (
          <Grid
            item
            xs={12}
          >
            <DeveloperForm store={store} />{' '}
          </Grid>
        ) : null}
        {selectedTab === TAB_DOCS ? (
          <Grid
            item
            xs={12}
          >
            <DocumentsTab
              store={store}
              selectedTeamProject={selectedTeamProject}
            />
          </Grid>
        ) : null}
        {selectedTab === TAB_TEMPLATES ? (
          <Grid
            item
            xs={12}
          >
            <TemplatesTab
              store={store}
              selectedTeamProject={selectedTeamProject}
            />
          </Grid>
        ) : null}
      </Grid>
    </div>
  );
});

export default MainTabs;
