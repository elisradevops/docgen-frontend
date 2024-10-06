import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { useCookies } from 'react-cookie';

import DeveloperForm from '../forms/develeoperForm/DeveloperForm';
import DocFormGenerator from '../forms/docFormGenerator/DocFormGenerator';
import DocumentsTab from '../forms/documentsTab/DocumentsTab';

import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Container, Grid } from '@material-ui/core';
import STRGuide from '../common/STRGuide';
import STDGuide from '../common/STDGuide';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  button: {
    color: 'white',
    backgroundColor: 'red',
  },
}));

const MainTabs = observer(({ store }) => {
  const classes = useStyles();
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
        <div className={classes.root}>
          <Tabs
            value={selectedTab}
            onChange={(event, newValue) => {
              setSelectedTab(newValue);
            }}
            aria-label='document tabs'
          >
            {store.documentTypes.map((docType, key) => {
              return (
                <Tab
                  label={docType}
                  value={key}
                />
              );
            })}
            <Tab
              label='Developer Tab'
              value={4}
            />
            <Tab
              label='Documents'
              value={99}
            />
          </Tabs>
          <Button
            className={classes.button}
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </AppBar>
      {store.documentTypes.map((docType, key) => {
        return selectedTab === key ? (
          <Grid
            container
            spacing={2}
          >
            <Grid
              item
              xs={3}
            >
              <Box sx={{ mx: 1 }}>
                <DocFormGenerator
                  docType={docType}
                  store={store}
                />
              </Box>
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
