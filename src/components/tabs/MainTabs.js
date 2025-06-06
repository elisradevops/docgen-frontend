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
import { Autocomplete, Box, Grid, TextField, Tooltip } from '@mui/material';
import STRGuide from '../common/STRGuide';
import STDGuide from '../common/STDGuide';
import SVDGuide from '../common/SVDGuide';
import TemplatesTab from '../forms/templatesTab/TemplatesTab';
import ClearIcon from '@mui/icons-material/Clear';
import { indigo } from '@mui/material/colors';

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

const MainTabs = observer(({ store }) => {
  const [selectedTab, setSelectedTab] = useState(99);
  const [cookies, setCookie, removeCookie] = useCookies(['azuredevopsUrl', 'azuredevopsPat']);
  const [selectedTeamProject, setSelectedTeamProject] = useState(defaultItem);
  const [projectClearable, setProjectClearable] = useState(false);
  const logout = () => {
    removeCookie('azuredevopsUrl');
    removeCookie('azuredevopsPat');
  };

  useEffect(() => {
    if (cookies.azuredevopsUrl && cookies.azuredevopsPat) store.fetchUserDetails();
  }, [cookies]);

  useEffect(() => {
    if (store.documentTypes?.length > 0) {
      setSelectedTab(0);
    }
  }, [store.documentTypes?.length]);

  const generateGuide = (docType) => {
    switch (docType) {
      case 'STD':
        return <STDGuide />;
      case 'STR':
        return <STRGuide />;
      case 'SVD':
        return <SVDGuide />;
      default:
        return null;
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
              setProjectClearable(newValue === 100);
            }}
            aria-label='document tabs'
          >
            {store.documentTypes.map((docType, key) => {
              return (
                <StyledTab
                  label={docType}
                  value={key}
                />
              );
            })}
            <StyledTab
              label='Documents'
              value={99}
            />
            <StyledTab
              label='Templates'
              value={100}
            />
          </StyledTabs>
          <Box
            gap={1}
            px={1}
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <StyledButton
              startIcon={<DeveloperModeIcon />}
              onClick={() => setSelectedTab(4)}
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
              <Autocomplete
                disableClearable
                style={{ marginBlock: 8, width: 300 }}
                autoHighlight
                openOnFocus
                options={store.teamProjectsList.map((teamProject) => {
                  return { key: teamProject.id, text: teamProject.name };
                })}
                getOptionLabel={(option) => `${option.text}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Select a TeamProject'
                    variant='outlined'
                  />
                )}
                onChange={async (event, newValue) => {
                  setSelectedTeamProject(newValue || defaultItem);
                  store.setTeamProject(newValue?.key || '', newValue?.text || '');
                }}
                value={selectedTeamProject}
              />
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
          return selectedTab === key ? (
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
        {selectedTab === 4 ? (
          <Grid
            item
            xs={12}
          >
            <DeveloperForm store={store} />{' '}
          </Grid>
        ) : null}
        {selectedTab === 99 ? (
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
        {selectedTab === 100 ? (
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
