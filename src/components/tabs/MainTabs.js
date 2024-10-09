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
import { Box, Grid } from '@mui/material';
import STRGuide from '../common/STRGuide';
import STDGuide from '../common/STDGuide';

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
      {store.documentTypes.map((docType, key) => {
        return selectedTab === key ? (
          <Grid
            container
            spacing={2}
          >
            <Grid
              container
              item
              xs={3}
            >
              <DocFormGenerator
                docType={docType}
                store={store}
              />
            </Grid>

            <Grid
              item
              xs={9}
            >
              {generateGuide(docType)}
            </Grid>
          </Grid>
        ) : null;
      })}
      {selectedTab === 4 ? (
        <DeveloperForm
          store={store}
          index={0}
          value={4}
        />
      ) : null}
      {selectedTab === 99 ? (
        <DocumentsTab
          store={store}
          index={0}
          value={4}
        />
      ) : null}
    </div>
  );
});

export default MainTabs;
