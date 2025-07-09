import React, { useState } from 'react';
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

export default function SVDGuide() {
  // State for handling open/collapse status of nested lists
  const [openBaseDataTypes, setOpenBaseDataTypes] = useState(false);

  const handleBaseDataTypes = () => setOpenBaseDataTypes((prev) => !prev);
  return (
    <Box p={3}>
      <Typography
        variant='h4'
        gutterBottom
      >
        Guide to the SVD Generator Form
      </Typography>
      <List>
        <ListItem>
          <ListItemText
            primary='Include System Overview'
            secondary='Select a predefined system overview query from TFS'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Known Possible Bugs By Query'
            secondary='Select a predefined known possible bugs query from TFS'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Committer'
            secondary='Include the committer name of the commit in the SVD (optional)'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Upload Installation Instructions File'
            secondary='Upload a file containing installation instructions (*.doc, *.docx, *.pdf, *.txt file extensions are allowed)'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Linked Work Item Selection'
            secondary='Include linked work items in the SVD. Select the linked work item types (Feature, Requirement) and relationship types (Affects, Covered) to include.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Commits with Unrelated Work Items'
            secondary='Append commits with unrelated work items as an optional Appendix section in the SVD document'
          />
        </ListItem>
        <ListItemButton onClick={handleBaseDataTypes}>
          <ListItemIcon>{openBaseDataTypes ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Base Data Types'
            secondary='Select the base data types for the SVD'
          />
        </ListItemButton>
        <Collapse
          in={openBaseDataTypes}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Git-Object-Range'
                secondary='Select the repository, branch, or commit range for required commits.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Commit-Date'
                secondary='Select the repository, branch, and date range for required commits.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Pipeline-Range'
                secondary='Choose a pipeline, start and end pipeline versions for the required data. The end pipeline should not be before the start pipeline.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Release-Range'
                secondary='Choose a release, start and end release versions for the required data. The end release should not be before the start release.'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
}
