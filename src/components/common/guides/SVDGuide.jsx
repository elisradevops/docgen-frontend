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

const SVDGuide = () => {
  const [openBaseData, setOpenBaseData] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant='h5'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        SVD Change Log Guide
      </Typography>
      <List disablePadding>
        <ListItem>
          <ListItemText
            primary='Include System Overview'
            secondary='Select a predefined system overview query from Azure DevOps.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Known Possible Bugs'
            secondary='Choose a saved query that lists potential bugs relevant to this release.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Committer'
            secondary='Add the committer name to the change table.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Replace Task with parent item (if exists)'
            secondary='When enabled, Task work items are replaced by their immediate Requirement or Change Request parent (one level), if such a parent exists. Tasks whose parent is of any other type, or missing, are omitted, so Task rows may be removed from the results.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Upload Installation Instructions'
            secondary='Attach supplemental guidance (doc, pdf, txt).'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Linked work items (per change)'
            secondary='For each change included, fetch its linked Requirements and/or Features according to your selection. This does not affect which changes are included; it only controls which linked items are pulled for each change.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Filter by Work Item Type/State'
            secondary='Enable to restrict which changes are included based on their linked work item types and states. This filtering applies to the changes themselves (global), not to the per-change linked items.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Unlinked Commits'
            secondary='Append commits without linked work items as an additional appendix.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Include Pull Request Work Items'
            secondary='When enabled, work items linked only to completed PRs are merged into the change list. These are marked with a [PR] prefix in the Work Item Title.'
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary='Only Pull Requests (Date Range)'
            secondary='For date ranges only: shows completed PRs in the selected window instead of commit-based changes.'
          />
        </ListItem>

        <ListItem>
          <ListItemText
            primary='Comparison Mode'
            secondary={
              'Choose how releases are compared in the selected range. Consecutive (fast): compares only adjacent releases and is recommended when artifacts/services exist in most releases. All pairs (slow): compares every possible pair; use when artifacts/services appear only in non-adjacent releases and you want net changes across skipped versions. Note: All pairs can be much slower and may show repeated changes across multiple pairs.'
            }
          />
        </ListItem>

        <ListItemButton onClick={() => setOpenBaseData((prev) => !prev)}>
          <ListItemIcon>{openBaseData ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText
            primary='Base Data Types'
            secondary='Pick the source for change detection.'
          />
        </ListItemButton>
        <Collapse
          in={openBaseData}
          timeout='auto'
          unmountOnExit
        >
          <List
            component='div'
            disablePadding
          >
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Git Object Range'
                secondary='Select repository, branch, and commit range.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Commit Date Range'
                secondary='Filter commits by start and end dates.'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Pipeline Range'
                secondary='Choose pipeline runs (start to end).'
              />
            </ListItem>
            <ListItem sx={{ pl: 6 }}>
              <ListItemText
                primary='Release Range'
                secondary='Select release versions (start to end).'
              />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </Box>
  );
};

export default SVDGuide;
