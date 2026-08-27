import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Typography,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// Shown automatically after a SharePoint sync completes with at least one
// failed file — the backend's syncTemplates already returns a per-file
// { name, error } reason for every failure, but until now nothing rendered
// it; the post-sync toast only ever showed a bare count. Styled
// consistently with SharePointConflictDialog.jsx (Alert + List +
// ListItemText), not a new visual pattern.
const SharePointSyncResultsDialog = ({ open, onClose, result }) => {
  const syncedFiles = result?.syncedFiles || [];
  const failedFiles = result?.failedFiles || [];
  const identicalFiles = result?.identicalFiles || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ErrorOutlineIcon color="error" />
          Sync completed with errors
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {failedFiles.length} file{failedFiles.length === 1 ? '' : 's'} failed to sync — see the reason for each
          below. Fix it in SharePoint (or reassign its document type in the review dialog) and try again.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Failed ({failedFiles.length})
        </Typography>
        <List
          sx={{
            maxHeight: 300,
            overflow: 'auto',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            mb: 2,
          }}
        >
          {failedFiles.map((file, i) => (
            <React.Fragment key={`${file.name}-${i}`}>
              <ListItem>
                <ListItemText
                  primary={file.name}
                  secondary={file.error}
                  secondaryTypographyProps={{ color: 'error.main' }}
                />
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>

        <Typography variant="body2" color="text.secondary">
          {syncedFiles.length} file{syncedFiles.length === 1 ? '' : 's'} synced successfully
          {identicalFiles.length > 0
            ? `, ${identicalFiles.length} already up-to-date (skipped)`
            : ''}
          .
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointSyncResultsDialog;
