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
import { Autocomplete, Box, Grid, TextField } from '@mui/material';
import STRGuide from '../common/STRGuide';
import STDGuide from '../common/STDGuide';
import SVDGuide from '../common/SVDGuide';
import TemplatesTab from '../forms/templatesTab/TemplatesTab';
import logger from '../../utils/logger';
import { indigo } from '@mui/material/colors';

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
  const [selectedTeamProject, setSelectedTeamProject] = useState('');
  const [projectClearable, setProjectClearable] = useState(false);
  const logout = () => {
    removeCookie('azuredevopsUrl');
    removeCookie('azuredevopsPat');
  };

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
          <Autocomplete
            disableClearable={!projectClearable}
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
              setSelectedTeamProject(newValue?.text || '');
              store.setTeamProject(newValue?.key || '', newValue?.text || '');
            }}
          />
        </Grid>

        {store.documentTypes.map((docType, key) => {
          return selectedTab === key ? (
            <>
              <Grid
                item
                xs={3}
              >
                <DocFormGenerator
                  docType={docType}
                  store={store}
                  selectedTeamProject={selectedTeamProject}
                />
              </Grid>

              <Grid
                item
                xs={9}
              >
                {generateGuide(docType)}
              </Grid>
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
