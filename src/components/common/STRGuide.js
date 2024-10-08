import React, { useState } from 'react';
import { List, ListItem, ListItemText, ListSubheader, Collapse, Box, Typography } from '@material-ui/core';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';

export default function STRGuide() {
  // State for handling open/collapse status of nested lists
  const [openStepsExecution, setOpenStepsExecution] = useState(false);
  const [openStepsAnalysis, setOpenStepsAnalysis] = useState(false);
  const [openAttachmentTypes, setOpenAttachmentTypes] = useState(false);

  const handleClickStepsExecution = () => setOpenStepsExecution(!openStepsExecution);
  const handleClickStepsAnalysis = () => setOpenStepsAnalysis(!openStepsAnalysis);
  const handleClickAttachmentTypes = () => setOpenAttachmentTypes(!openAttachmentTypes);

  return (
    <Box p={3}>
      <Typography
        variant='h4'
        gutterBottom
      >
        Guide to the STR Generator Form
      </Typography>
      <List
        component='nav'
        aria-labelledby='nested-list-subheader'
      >
        {/* Main List Items */}
        <ListItem>
          <ListItemText
            primary='Enable Suite Specific Selection - Optional'
            secondary='You may select one or more specific suits in the selected Test Plan'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Display Configuration Name - Optional'
            secondary='The configuration Name will appear in the Test Execution table'
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary='Display Test Group Hierarchy - Optional'
            secondary='The Test Suite will appear as Path Top Parent Suite/.../Direct Suite. Uncheck that option and only the Direct Suite will appear.'
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary='Open PCRs'
            secondary='Present the Open Linked Bug / CR.'
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary='Test Log'
            secondary='A Log table with test name, execution date and tester will be created as Evidence.'
          />
        </ListItem>

        {/* Collapsible for Generate Detailed Steps Execution */}
        <ListItem
          button
          onClick={handleClickStepsExecution}
        >
          <ListItemText
            primary='Generate Detailed Steps Execution'
            secondary='The STD / ATP will be generated, for each step in test procedure table, the Run status and the Actual Result (Comment) will be generated in 2 different columns.'
          />
          {openStepsExecution ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Collapse
          in={openStepsExecution}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Generate Attachments'
                secondary='Include attachments for any step in the selected suites cases.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Generate Covered Requirements'
                secondary='Include covered requirement table or not.'
              />
            </ListItem>
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Trace Analysis'
                secondary='TBD'
              />
            </ListItem>
          </List>
        </Collapse>

        {/* Collapsible for Generate Detailed Steps Analysis */}
        <ListItem
          button
          onClick={handleClickStepsAnalysis}
        >
          <ListItemText
            primary='Generate Detailed Steps Analysis'
            secondary='The Test Run Comments and the Test Run Attachments will be appear in that Appendix.'
          />
          {openStepsAnalysis ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Collapse
          in={openStepsAnalysis}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem style={{ paddingLeft: 32 }}>
              <ListItemText
                primary='Generate Run Attachments'
                secondary='Include test run attachments.'
              />
            </ListItem>
          </List>
        </Collapse>

        {/* Collapsible for Attachment Types */}
        <ListItem
          button
          onClick={handleClickAttachmentTypes}
        >
          <ListItemText
            primary='Attachment Types'
            secondary='If the document is zipped, then please extract the files using WinRAR and open them.'
          />
          {openAttachmentTypes ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Collapse
          in={openAttachmentTypes}
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
      </List>
    </Box>
  );
}
