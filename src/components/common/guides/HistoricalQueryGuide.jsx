import React, { useState } from 'react';
import {
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

const HistoricalQueryGuide = () => {
  const [openAsOf, setOpenAsOf] = useState(false);
  const [openCompare, setOpenCompare] = useState(false);
  const [openFavorites, setOpenFavorites] = useState(false);
  const [openSendRequest, setOpenSendRequest] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h5' sx={{ fontWeight: 600, mb: 2 }}>
        Historical Query Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Select Shared Query'
            secondary='Pick a shared Azure DevOps query from the selector before running snapshot or compare.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenAsOf((prev) => !prev)}>
          <ListItemIcon>{openAsOf ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='As Of Mode'
            secondary='Run a point-in-time snapshot to inspect values at a specific timestamp.'
          />
        </ListItemButton>
        <Collapse in={openAsOf} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Of Timestamp'
                secondary='Choose the exact historical date and time for query execution.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Snapshot Output'
                secondary='Review point-in-time values, revision metadata, and direct links to work items.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenCompare((prev) => !prev)}>
          <ListItemIcon>{openCompare ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Compare Mode'
            secondary='Compare two timestamps and classify Added, Deleted, Changed, and No changes.'
          />
        </ListItemButton>
        <Collapse in={openCompare} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Baseline and Compare To'
                secondary='Set two timestamps to calculate differences between snapshots.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Diff Indicators'
                secondary='Use compare-status and changed-fields columns to focus on relevant changes.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenFavorites((prev) => !prev)}>
          <ListItemIcon>{openFavorites ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Favorites'
            secondary='Save and reload historical-query settings for the current project.'
          />
        </ListItemButton>
        <Collapse in={openFavorites} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Reusable Presets'
                secondary='Favorites keep mode, query, and date inputs for quick reruns.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenSendRequest((prev) => !prev)}>
          <ListItemIcon>{openSendRequest ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Send Request'
            secondary='Generate a historical compare Word report after running compare.'
          />
        </ListItemButton>
        <Collapse in={openSendRequest} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Report Generation'
                secondary='The compare result is sent through the regular DocGen pipeline as a content-control request.'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
};

export default HistoricalQueryGuide;
