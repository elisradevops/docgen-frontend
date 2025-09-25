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

const SRSGuide = () => {
  const [openTraceability, setOpenTraceability] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h5' sx={{ fontWeight: 600, mb: 2 }}>
        SRS Traceability Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Include System Requirements'
            secondary='Select a predefined System Requirements query from Azure DevOps (TFS). Use either a "Tree of work items" or a "Work items and direct links" query. Flat list queries are not supported.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenTraceability((prev) => !prev)}>
          <ListItemIcon>{openTraceability ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Traceability Sections'
            secondary='Include bidirectional traceability between System and Software requirements.'
          />
        </ListItemButton>
        <Collapse in={openTraceability} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='System → Software Requirements'
                secondary='Select a "Work items and direct links" query that returns links from System to Software requirements. Ensure the query filters the correct Area Path.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Software → System Requirements'
                secondary='Select a "Work items and direct links" query that returns links from Software to System requirements. Ensure the query filters the relevant Area Path.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenNotes((prev) => !prev)}>
          <ListItemIcon>{openNotes ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Notes & Behaviour'
            secondary='Additional details on how selections behave.'
          />
        </ListItemButton>
        <Collapse in={openNotes} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Availability of Queries'
                secondary='Sections enable once the corresponding query tree becomes available from Shared Queries.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Supported Query Types'
                secondary='System requirements support "Tree of work items" and "Work items and direct links". Traceability requires "Work items and direct links" with Area Path filters.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='One Query per Section'
                secondary='Each section uses a single query. Clearing the checkbox removes the saved selection.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Unchecking Clears Selection'
                secondary='If you uncheck an include option, the associated query is cleared to avoid stale selections.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Favorites'
                secondary='Favorites restore saved queries when the underlying queries still exist.'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
};

export default SRSGuide;
