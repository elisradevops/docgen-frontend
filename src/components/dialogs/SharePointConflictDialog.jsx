import React, { useState } from 'react';
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
  ListItemIcon,
  Checkbox,
  Typography,
  Divider,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const SharePointConflictDialog = ({ open, onClose, onProceed, conflicts, newFiles, totalFiles }) => {
  const [selectedConflicts, setSelectedConflicts] = useState(
    conflicts ? conflicts.map((c) => c.name) : []
  );

  const handleToggle = (fileName) => {
    setSelectedConflicts((prev) =>
      prev.includes(fileName) ? prev.filter((name) => name !== fileName) : [...prev, fileName]
    );
  };

  const handleSelectAll = () => {
    if (selectedConflicts.length === conflicts.length) {
      setSelectedConflicts([]);
    } else {
      setSelectedConflicts(conflicts.map((c) => c.name));
    }
  };

  const handleProceed = () => {
    // Files to skip are the ones that are in conflicts but NOT selected for overwrite
    const filesToSkip = conflicts
      .filter((c) => !selectedConflicts.includes(c.name))
      .map((c) => c.name);
    
    onProceed(filesToSkip);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          File Conflicts Detected
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Some files already exist in MinIO. Select which files you want to overwrite. Unselected
            files will be skipped.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Summary:</strong> {totalFiles} files found in SharePoint
            <br />• {newFiles?.length || 0} new files will be added
            <br />• {conflicts?.length || 0} files will replace existing files (if selected)
          </Typography>

          {conflicts && conflicts.length > 0 && (
            <>
              <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="text.primary">
                  Files with conflicts ({selectedConflicts.length} of {conflicts.length} selected to
                  overwrite):
                </Typography>
                <Button size="small" onClick={handleSelectAll}>
                  {selectedConflicts.length === conflicts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>

              <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {conflicts.map((file, index) => (
                  <React.Fragment key={file.name}>
                    {index > 0 && <Divider />}
                    <ListItem
                      dense
                      button
                      onClick={() => handleToggle(file.name)}
                      sx={{
                        bgcolor: selectedConflicts.includes(file.name)
                          ? 'action.selected'
                          : 'background.paper',
                      }}
                    >
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={selectedConflicts.includes(file.name)}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={
                          file.sizeChanged
                            ? `Size changed: ${formatBytes(file.existingSize || 0)} → ${formatBytes(file.size)}${file.docType ? ` • DocType: ${file.docType}` : ''}`
                            : `Size: ${formatBytes(file.size)}${file.docType ? ` • DocType: ${file.docType}` : ''}`
                        }
                        secondaryTypographyProps={{
                          color: file.sizeChanged ? 'warning.main' : 'text.secondary'
                        }}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </>
          )}

          {newFiles && newFiles.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.primary" sx={{ mt: 3, mb: 1 }}>
                New files (will be added):
              </Typography>
              <List sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {newFiles.map((file, index) => (
                  <React.Fragment key={file.name}>
                    {index > 0 && <Divider />}
                    <ListItem dense>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`Size: ${formatBytes(file.size)}${file.docType ? ` • DocType: ${file.docType}` : ''}`}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleProceed} variant="contained" color="primary">
          Proceed with Sync ({selectedConflicts.length + (newFiles?.length || 0)} files)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointConflictDialog;
