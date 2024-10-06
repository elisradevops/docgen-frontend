import React, { useState } from 'react';
import { List, ListItem, ListItemText, ListSubheader, Collapse, Box, Typography } from '@material-ui/core';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';

export default function STDGuide() {
  // State for handling open/collapse status of nested lists
  const [openBugs, setOpenBugs] = useState(false);
  const [openRequirements, setOpenRequirements] = useState(false);
  const [openIncludeAttachmentTypes, setIncludeAttachmentTypes] = useState(false);

  const handleClickBugs = () => setOpenBugs(!openBugs);
  const handleClickRequirements = () => setOpenRequirements(!openRequirements);
  const handleClickAttachmentTypes = () => setIncludeAttachmentTypes(!openIncludeAttachmentTypes);

  return (
    <Box p={3}>
      <Typography
        variant='h4'
        gutterBottom
      >
        Guide to the STD Generator Form
      </Typography>
      <List
        component='nav'
        aria-labelledby='nested-list-subheader'
      >
        {/* Main List Items */}

        {/* Collapsible for Attachment Types */}
        <ListItem
          button
          onClick={handleClickAttachmentTypes}
        >
          <ListItemText
            primary='Attachment Types'
            secondary='If the document is zipped, then please extract the files.'
          />
          {openIncludeAttachmentTypes ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
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

        <ListItem
          button
          onClick={handleClickRequirements}
        >
          <ListItemText
            primary='Include Requirements'
            secondary='Include or exclude the requirements table in the STD document.'
          />
          {openRequirements ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
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

        <ListItem
          button
          onClick={handleClickBugs}
        >
          <ListItemText
            primary='Include Bugs'
            secondary='Include or exclude the bugs table in the STD document'
          />
          {openBugs ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
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
      </List>
    </Box>
  );
}
