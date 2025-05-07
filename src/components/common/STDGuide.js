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
  const [openRequirements, setOpenRequirements] = useState(false);
  const [openIncludeAttachmentTypes, setIncludeAttachmentTypes] = useState(false);
  const [openTraceAnalysisMode, setOpenTraceAnalysisMode] = useState(false);

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
        <ListItem>
          <ListItemText
            primary='Generate STD for Manual Formal Testing (Hard Copy)'
            secondary='Retrieve the STD document for manual formal testing.'
          />
        </ListItem>
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
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Include Attachment Content'
                secondary={
                  <Typography
                    component='span'
                    variant='body2'
                  >
                    Include the content of the attached files in the STD document. (Only word documents are
                    supported for this feature)
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
        <ListItem>
          <ListItemText
            primary='Include Linked Mom'
            secondary='Include linked Work Item (Task/Bug) in the STD document.'
          />
        </ListItem>
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
                secondary='Fetch trace analysis based on the linked requirements'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Based On Queries'
                secondary='Fetch both trace analysis and covered requirements based on the selected queries (disabled if no available queries)'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Include Common Columns'
                secondary='When there is a duplicated column, you may select to include both or only one of them.'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
}
