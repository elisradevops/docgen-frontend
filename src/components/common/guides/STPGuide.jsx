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

const STPGuide = () => {
  const [openAttachments, setOpenAttachments] = useState(false);
  const [openRequirements, setOpenRequirements] = useState(false);
  const [openTraceAnalysis, setOpenTraceAnalysis] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h5' sx={{ fontWeight: 600, mb: 2 }}>
        STP Document Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Generate STP for Planned Testing'
            secondary='Create a planned-test document with suite/test-case details and traceability before execution.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Automatic Flattening'
            secondary='Flatten single-suite test cases is handled automatically when exactly one suite is selected.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Suite-Specific Selection'
            secondary='You may select one or more suites from the chosen test plan. Descendant suites are auto-included.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='No Manual Hard-Copy Run'
            secondary='STP does not generate manual hard-copy run printouts.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Linked MOM'
            secondary='Include linked Work Items in the STP document by relation or query.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenAttachments((prev) => !prev)}>
          <ListItemIcon>{openAttachments ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Attachments & Evidence'
            secondary='Control how attachments are embedded in the STP.'
          />
        </ListItemButton>
        <Collapse in={openAttachments} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Embedded'
                secondary='Images and supported files are embedded where relevant in the STP.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Link'
                secondary='Files are linked from the STP output instead of being embedded inline.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Include Attachment Content'
                secondary='Inline supported document types (Word) directly in the STP.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenRequirements((prev) => !prev)}>
          <ListItemIcon>{openRequirements ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Requirements Section'
            secondary='Include or exclude requirement details in STP sections and trace tables.'
          />
        </ListItemButton>
        <Collapse in={openRequirements} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Include Customer ID'
                secondary='Adds the Customer ID column where requirement tables are generated.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenTraceAnalysis((prev) => !prev)}>
          <ListItemIcon>{openTraceAnalysis ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Trace Analysis Options'
            secondary='Include or exclude traceability appendices.'
          />
        </ListItemButton>
        <Collapse in={openTraceAnalysis} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='No Trace'
                secondary='Exclude trace analysis.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Based on Linked Requirements'
                secondary='Fetch trace analysis using linked requirement relationships.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Based on Queries'
                secondary='Fetch trace analysis using saved queries.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Include Common Columns'
                secondary='Choose how to handle duplicate columns between query sources.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItem>
          <ListItemText
            primary='Generated STP Content'
            secondary='Includes Items to Be Tested table, detailed test descriptions (description, optional linked requirements, test phase), and bidirectional traceability tables.'
          />
        </ListItem>
      </List>
    </Box>
  );
};

export default STPGuide;
