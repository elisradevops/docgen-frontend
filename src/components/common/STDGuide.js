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

export default function STDGuide() {
  // State for handling open/collapse status of nested lists
  const [openBugs, setOpenBugs] = useState(false);
  const [openRequirements, setOpenRequirements] = useState(false);
  const [openIncludeAttachmentTypes, setIncludeAttachmentTypes] = useState(false);
  const [openTraceAnalysisMode, setOpenTraceAnalysisMode] = useState(false);

  const handleClickBugs = () => setOpenBugs((prev) => !prev);
  const handleClickRequirements = () => setOpenRequirements((prev) => !prev);
  const handleClickAttachmentTypes = () => setIncludeAttachmentTypes((prev) => !prev);
  const handleClickAnalysisType = () => setOpenTraceAnalysisMode((prev) => !prev);

  return (
    <Box p={3}>
      <Typography
        variant='h4'
        gutterBottom
      >
        Guide to the STD Generator Form
      </Typography>
      <List>
        {/* Main List Items */}

        {/* Collapsible for Attachment Types */}
        <ListItemButton onClick={handleClickAttachmentTypes}>
          <ListItemIcon>{openIncludeAttachmentTypes ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Attachment Types'
            secondary='If the document is zipped, then please extract the files.'
          />
        </ListItemButton>
        <Collapse
          in={openIncludeAttachmentTypes}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='As Embedded'
                secondary={
                  <Typography
                    component='span'
                    variant='body2'
                  >
                    Pictures / Images will be presented in both options:
                    <br />
                    - Attached Images in Step Level - Will be displayed in the Test Steps procedure table.
                    <br />- Attached Images In Test Level - Will be presented after the test steps procedure.
                  </Typography>
                }
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='As Link'
                secondary={
                  <Typography
                    component='span'
                    variant='body2'
                  >
                    Office Documents will be downloaded to a Zip File with the other files, and they will open
                    automatically from a link.
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={handleClickRequirements}>
          <ListItemIcon>{openRequirements ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Include Requirements'
            secondary='Include or exclude the requirements table in the STD document.'
          />
        </ListItemButton>
        <Collapse
          in={openRequirements}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Include Customer ID'
                secondary='Include Customer ID column to the requirement table.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={handleClickBugs}>
          <ListItemIcon>{openBugs ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Include Bugs'
            secondary='Include or exclude the bugs table in the STD document'
          />
        </ListItemButton>
        <Collapse
          in={openBugs}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Include Severity'
                secondary='Include the severity level of the related bug in the table.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItem>
          <ListItemText
            primary='Enable Suite Specific Selection - Optional'
            secondary='You may select one or more specific suits in the selected Test Plan.'
          />
        </ListItem>
        <ListItemButton onClick={handleClickAnalysisType}>
          <ListItemIcon>{openTraceAnalysisMode ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Include Trace Analysis'
            secondary='Include or exclude trace analysis'
          />
        </ListItemButton>
        <Collapse
          in={openTraceAnalysisMode}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='No Trace'
                secondary='Exclude trace analysis'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Based On Linked Requirements'
                secondary='Fetch trace analysis based on the linked requirements (TBD)'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Based On Queries'
                secondary='Fetch trace analysis based on TFS predefined queries (if disabled there are no saved queries)'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
}
