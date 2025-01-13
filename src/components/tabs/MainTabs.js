import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { useCookies } from 'react-cookie';

import DeveloperForm from '../forms/develeoperForm/DeveloperForm';
import DocFormGenerator from '../forms/docFormGenerator/DocFormGenerator';
import DocumentsTab from '../forms/documentsTab/DocumentsTab';

import AppBar from '@mui/material/AppBar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import { Autocomplete, Box, Grid, TextField } from '@mui/material';
import STRGuide from '../common/STRGuide';
import STDGuide from '../common/STDGuide';
import SVDGuide from '../common/SVDGuide';

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

const StyledButton = styled(Button)(({ theme }) => ({
  color: 'white',
  backgroundColor: 'red',
  '&:hover': {
    backgroundColor: 'darkred',
  },
}));

const MainTabs = observer(({ store }) => {
  const [selectedTab, setSelectedTab] = useState(4);
  const [cookies, setCookie, removeCookie] = useCookies(['azuredevopsUrl', 'azuredevopsPat']);
  const [selectedTeamProject, setSelectedTeamProject] = useState('');
  const logout = () => {
    removeCookie('azuredevopsUrl');
    removeCookie('azuredevopsPat');
  };

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
              label='Developer Tab'
              value={4}
            />
            <StyledTab
              label='Documents'
              value={99}
            />
          </StyledTabs>
          <StyledButton onClick={logout}>Logout</StyledButton>
        </Box>
      </AppBar>
      <Grid container>
        <Grid
          item
          xs={12}
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
              setSelectedTeamProject(newValue.text);
              store.setTeamProject(newValue.key, newValue.text);
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
      </Grid>
    </div>
  );
});

export default MainTabs;
