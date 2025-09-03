import React from 'react';

import {
  List,
  ListItem,
  ListItemText,
  Collapse,
  Box,
  Typography,
  ListItemButton,
  ListItemIcon,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

export default function SRSGuide() {
  const [openTraceability, setOpenTraceability] = React.useState(false);
  const [openNotes, setOpenNotes] = React.useState(false);

  const handleTraceability = () => setOpenTraceability((prev) => !prev);
  const handleNotes = () => setOpenNotes((prev) => !prev);

  return (
    <Box p={3}>
      <Typography
        variant='h4'
        gutterBottom
      >
        Guide to the SRS Generator Form
      </Typography>
      <List>
        <ListItem>
          <ListItemText
            primary='Include System Requirements'
            secondary='Select a predefined System Requirements query from Azure DevOps (TFS). Use either a "Tree of work items" or a "Work items and direct links" query. Flat list queries are not supported.'
          />
        </ListItem>

        <ListItemButton onClick={handleTraceability}>
          <ListItemIcon>{openTraceability ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Traceability Sections'
            secondary='Include bidirectional traceability between System and Software requirements. For traceability, only "Work items and direct links" queries are supported and they must include the relevant Area Path filter.'
          />
        </ListItemButton>
        <Collapse
          in={openTraceability}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Include System to Software Requirements'
                secondary='Select a predefined "Work items and direct links" query that returns links from System Requirements to Software Requirements (System -> Software). Ensure the query filters by the relevant Area Path.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Include Software to System Requirements'
                secondary='Select a predefined "Work items and direct links" query that returns links from Software Requirements to System Requirements (Software -> System). Ensure the query filters by the relevant Area Path.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={handleNotes}>
          <ListItemIcon>{openNotes ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Notes & Behavior'
            secondary='Additional details about how selections work.'
          />
        </ListItemButton>
        <Collapse
          in={openNotes}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Availability of Queries'
                secondary='Each section becomes enabled when a corresponding query tree is available (provided by Shared Queries). If a tree is empty or missing, the section will be disabled.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Supported Query Types'
                secondary='System Requirements: use either "Tree of work items" or "Work items and direct links". Traceability: only "Work items and direct links" queries are supported and must include a filter on the relevant Area Path. "Flat list of work items" queries are not used.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='One Query per Section'
                secondary='For each included section, select exactly one query from the tree.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Unchecking Clears Selection'
                secondary='If you uncheck an “Include …” option, its selected query will be cleared.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Favorites'
                secondary='When loading a saved Favorite, the previously selected queries are restored automatically if available.'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
}
