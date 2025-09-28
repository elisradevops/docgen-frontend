import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Collapse,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

const SVDGuide = () => {
  const [openBaseData, setOpenBaseData] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h5' sx={{ fontWeight: 600, mb: 2 }}>
        SVD Change Log Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Include System Overview'
            secondary='Select a predefined system overview query from Azure DevOps.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Known Possible Bugs'
            secondary='Choose a saved query that lists potential bugs relevant to this release.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Committer'
            secondary='Add the committer name to the change table.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Upload Installation Instructions'
            secondary='Attach supplemental guidance (doc, pdf, txt).' 
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Linked Work Item Selection'
            secondary='Configure which linked requirements or features are included using the dialog.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Filter by Work Item Type/State'
            secondary='Enable the checkbox to activate filtering. By default all types and states are included. Use the multi-select pickers to narrow down the list, or the quick “Select all” / “Clear” actions to adjust selections.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Unlinked Commits'
            secondary='Append commits without linked work items as an additional appendix.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenBaseData((prev) => !prev)}>
          <ListItemIcon>{openBaseData ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Base Data Types'
            secondary='Pick the source for change detection.'
          />
        </ListItemButton>
        <Collapse in={openBaseData} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Git Object Range'
                secondary='Select repository, branch, and commit range.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Commit Date Range'
                secondary='Filter commits by start and end dates.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Pipeline Range'
                secondary='Choose pipeline runs (start to end).'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Release Range'
                secondary='Select release versions (start to end).'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
};

export default SVDGuide;
