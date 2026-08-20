import React, { useState, useEffect, useMemo } from 'react';
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
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  Divider,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { computeFilesToSkip } from '../../utils/sharePointReview';

const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (isoString) => (isoString ? new Date(isoString).toLocaleString() : '—');

const SharePointConflictDialog = ({ open, onClose, onProceed, conflicts, newFiles, totalFiles }) => {
  const allNames = useMemo(
    () => [...(conflicts || []), ...(newFiles || [])].map((f) => f.name),
    [conflicts, newFiles]
  );
  // Everything starts checked by default — conflicts default to "overwrite",
  // new files default to "include", matching the prior conflict-only
  // behavior for conflicts and extending the same default to new files.
  // The dialog is mounted once and toggled via `open`, so this can't be a
  // one-shot useState initializer — it must reset whenever the dialog opens
  // with a fresh set of files.
  const [selectedNames, setSelectedNames] = useState([]);

  useEffect(() => {
    if (open) setSelectedNames(allNames);
  }, [open, allNames]);

  const handleToggle = (fileName) => {
    setSelectedNames((prev) =>
      prev.includes(fileName) ? prev.filter((name) => name !== fileName) : [...prev, fileName]
    );
  };

  const handleSelectAll = () => {
    setSelectedNames((prev) => (prev.length === allNames.length ? [] : allNames));
  };

  const handleProceed = () => {
    onProceed(computeFilesToSkip(conflicts, newFiles, selectedNames));
  };

  const renderRow = (file, { isConflict }) => (
    <React.Fragment key={file.name}>
      <ListItemButton
        dense
        onClick={() => handleToggle(file.name)}
        sx={{
          bgcolor: selectedNames.includes(file.name) ? 'action.selected' : 'background.paper',
        }}
      >
        <ListItemIcon>
          <Checkbox
            edge="start"
            checked={selectedNames.includes(file.name)}
            disableRipple
          />
        </ListItemIcon>
        <ListItemText
          primary={`${file.name}${isConflict ? ' (conflict)' : ''}`}
          secondary={
            <>
              Created: {formatDate(file.timeCreated)} • Modified: {formatDate(file.timeLastModified)} • Size:{' '}
              {isConflict && file.sizeChanged
                ? `${formatBytes(file.existingSize || 0)} → ${formatBytes(file.size)}`
                : formatBytes(file.size)}
              {file.docType ? ` • DocType: ${file.docType}` : ''}
            </>
          }
          secondaryTypographyProps={{
            color: isConflict && file.sizeChanged ? 'warning.main' : 'text.secondary',
          }}
        />
      </ListItemButton>
      <Divider />
    </React.Fragment>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {conflicts && conflicts.length > 0 && <WarningIcon color="warning" />}
          Review Files to Sync
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box>
          {conflicts && conflicts.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Some files already exist in MinIO. Uncheck any you don't want to overwrite.
            </Alert>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Summary:</strong> {totalFiles} file{totalFiles === 1 ? '' : 's'} found in SharePoint —{' '}
              {selectedNames.length} selected to sync
            </Typography>
            <Button size="small" onClick={handleSelectAll}>
              {selectedNames.length === allNames.length ? 'Deselect All' : 'Select All'}
            </Button>
          </Box>

          <List
            sx={{
              maxHeight: 400,
              overflow: 'auto',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            {(conflicts || []).map((file) => renderRow(file, { isConflict: true }))}
            {(newFiles || []).map((file) => renderRow(file, { isConflict: false }))}
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleProceed} variant="contained" color="primary" disabled={selectedNames.length === 0}>
          Proceed with Sync ({selectedNames.length} files)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointConflictDialog;
