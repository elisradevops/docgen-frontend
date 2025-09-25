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

const STRGuide = () => {
  const [openStepsExecution, setOpenStepsExecution] = useState(false);
  const [openStepsAnalysis, setOpenStepsAnalysis] = useState(false);
  const [openAttachmentTypes, setOpenAttachmentTypes] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h5' sx={{ fontWeight: 600, mb: 2 }}>
        STR Report Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Suite-Specific Selection'
            secondary='Select one or more suites from the chosen test plan. Descendant suites are auto-included.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Configuration & Hierarchy Columns'
            secondary='Display configuration names and/or the full suite hierarchy in the execution table.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Open PCRs & Test Log'
            secondary='Include linked bugs/CRs and a test log evidence appendix.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Manual Hard-Copy Run'
            secondary='Generate a printable manual run summary.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenStepsExecution((prev) => !prev)}>
          <ListItemIcon>{openStepsExecution ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Detailed Steps Execution'
            secondary='Capture per-step results and attachments.'
          />
        </ListItemButton>
        <Collapse in={openStepsExecution} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Flatten Test Cases'
                secondary='Display only direct cases when focusing on a single suite.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Generate Attachments'
                secondary='Include attachments for executed steps.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Generate Covered Requirements'
                secondary='Append requirement coverage based on your trace config.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenStepsAnalysis((prev) => !prev)}>
          <ListItemIcon>{openStepsAnalysis ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Detailed Steps Analysis'
            secondary='Add run-level comments and attachments appendix.'
          />
        </ListItemButton>
        <Collapse in={openStepsAnalysis} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Generate Run Attachments'
                secondary='Include attachments from the test run level.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenAttachmentTypes((prev) => !prev)}>
          <ListItemIcon>{openAttachmentTypes ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Attachment Delivery Options'
            secondary='Choose how evidence files are packaged.'
          />
        </ListItemButton>
        <Collapse in={openAttachmentTypes} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Embedded'
                secondary='Inline images within the procedure or following sections.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Link'
                secondary='Bundle large files into a ZIP and link them from the STR.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Evidence Source'
                secondary='Select whether attachments come from test steps, runs, or both.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Include Attachment Content'
                secondary='Inline supported file types (Word) directly in the report.'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
};

export default STRGuide;
