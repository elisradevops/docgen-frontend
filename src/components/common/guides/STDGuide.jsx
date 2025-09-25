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

const STDGuide = () => {
  const [openAttachments, setOpenAttachments] = useState(false);
  const [openRequirements, setOpenRequirements] = useState(false);
  const [openTraceAnalysis, setOpenTraceAnalysis] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant='h5' sx={{ fontWeight: 600, mb: 2 }}>
        STD Document Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Generate STD for Manual Formal Testing (Hard Copy)'
            secondary='Retrieve the STD document for manual formal testing.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Flatten Test Cases of a Single Suite'
            secondary='Display only the test cases directly linked to a single selected suite.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenAttachments((prev) => !prev)}>
          <ListItemIcon>{openAttachments ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Attachments & Evidence'
            secondary='Control how attachments are embedded in the STD.'
          />
        </ListItemButton>
        <Collapse in={openAttachments} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Embedded'
                secondary='Step-level images appear in the test procedure table; test-level images appear after the procedure.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='As Link'
                secondary='Office documents are packaged into a ZIP and linked from the STD.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Include Attachment Content'
                secondary='Inline supported document types (Word) directly in the STD.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItemButton onClick={() => setOpenRequirements((prev) => !prev)}>
          <ListItemIcon>{openRequirements ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Requirements Section'
            secondary='Include or exclude the requirements table.'
          />
        </ListItemButton>
        <Collapse in={openRequirements} timeout='auto' unmountOnExit>
          <List component='div' disablePadding>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Include Customer ID'
                secondary='Adds the Customer ID column to the requirements table.'
              />
            </ListItem>
          </List>
        </Collapse>

        <ListItem>
          <ListItemText
            primary='Include Linked MOM'
            secondary='Include linked Work Items in the STD document. These can be added either by relationship or by using queries.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Suite-Specific Selection'
            secondary='You may select one or more suites in the chosen test plan.'
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenTraceAnalysis((prev) => !prev)}>
          <ListItemIcon>{openTraceAnalysis ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Trace Analysis Options'
            secondary='Include or exclude trace analysis appendices.'
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
                secondary='Fetch trace analysis and covered requirements using saved queries.'
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
      </List>
    </Box>
  );
};

export default STDGuide;
