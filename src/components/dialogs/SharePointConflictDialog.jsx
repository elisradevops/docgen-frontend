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
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import {
  computeFilesToSkip,
  computeDocTypeOverrides,
  guessDocTypeFromFilename,
  orderRowsForReview,
} from '../../utils/sharePointReview';
import { appendScanCaveats } from './sharePointFolderPreview';

const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (isoString) => (isoString ? new Date(isoString).toLocaleString() : '—');

const SharePointConflictDialog = ({
  open,
  onClose,
  onProceed,
  conflicts,
  newFiles,
  totalFiles,
  documentTypes,
  truncated,
  skippedFolders,
}) => {
  // Identity is relativePath, not name — recursive SharePoint listing
  // permits duplicate basenames living in different folders.
  const allFiles = useMemo(() => [...(conflicts || []), ...(newFiles || [])], [conflicts, newFiles]);
  const allPaths = useMemo(() => allFiles.map((f) => f.relativePath), [allFiles]);

  // Reuses the same caveat copy the Connect dialog's preview shows — the
  // scan's own outcome (capped/partially-denied) rather than anything
  // about docType validity, so start from an empty base message.
  const scanCaveatMessage = useMemo(() => {
    if (!truncated && (!skippedFolders || skippedFolders.length === 0)) return null;
    const { message } = appendScanCaveats(
      { status: 'success', canConnect: true, message: '' },
      { truncated, skippedFolders }
    );
    return message.trim();
  }, [truncated, skippedFolders]);

  // Everything starts checked by default — conflicts default to "overwrite",
  // new files default to "include", matching the prior conflict-only
  // behavior for conflicts and extending the same default to new files.
  // The dialog is mounted once and toggled via `open`, so this can't be a
  // one-shot useState initializer — it must reset whenever the dialog opens
  // with a fresh set of files.
  const [selectedPaths, setSelectedPaths] = useState([]);
  // O(1) row-membership lookup for renderRow — with up to 500 rows (the
  // backend's own recursion cap), `selectedPaths.includes()` per row per
  // render would be an O(n²) scan; `selectedPaths` itself stays an array
  // since its order/length are used elsewhere (handleSelectAll, the
  // "N selected" count).
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  // Per-row Document Type, pre-filled from auto-detection (file.docType)
  // when the backend recognized the parent folder name; blank otherwise —
  // blank means the user must pick one before that row can sync.
  const [docTypeByPath, setDocTypeByPath] = useState({});
  // Rows whose current docType came from guessDocTypeFromFilename (a
  // filename heuristic), not real auto-detection or a user's own choice —
  // rendered with a "Suggested" marker so a guess is never mistaken for a
  // confirmed value. Cleared the moment the user touches that row's Select.
  const [guessedPaths, setGuessedPaths] = useState(() => new Set());
  // Row display order, snapshotted once when the dialog opens (after
  // filename guesses are applied) — sorting against LIVE docTypeByPath
  // would make a row jump out from under the user's cursor the instant
  // they pick its type, so this is computed here, not derived on render.
  const [orderedRows, setOrderedRows] = useState([]);

  useEffect(() => {
    if (!open) return;
    setSelectedPaths(allPaths);
    const initialDocTypes = {};
    const guessed = new Set();
    allFiles.forEach((f) => {
      if (f.docType) {
        initialDocTypes[f.relativePath] = f.docType;
        return;
      }
      // Pre-select only — never treated as a confirmed value (see
      // guessedPaths above).
      const guess = guessDocTypeFromFilename(f.name, documentTypes);
      initialDocTypes[f.relativePath] = guess;
      if (guess) guessed.add(f.relativePath);
    });
    setDocTypeByPath(initialDocTypes);
    setGuessedPaths(guessed);
    setOrderedRows(orderRowsForReview(conflicts, newFiles, initialDocTypes));
  }, [open, allPaths, allFiles, documentTypes, conflicts, newFiles]);

  const handleToggle = (relativePath) => {
    setSelectedPaths((prev) =>
      prev.includes(relativePath) ? prev.filter((path) => path !== relativePath) : [...prev, relativePath]
    );
  };

  const handleDocTypeChange = (relativePath, value) => {
    setDocTypeByPath((prev) => ({ ...prev, [relativePath]: value }));
    // The user made their own choice — this row's value is no longer just
    // a suggestion, whatever it's set to now.
    setGuessedPaths((prev) => {
      if (!prev.has(relativePath)) return prev;
      const next = new Set(prev);
      next.delete(relativePath);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPaths((prev) => (prev.length === allPaths.length ? [] : allPaths));
  };

  // Bulk-assign a single Document Type to every currently-selected row —
  // for a flat folder with many unmapped files, picking a type one row at
  // a time doesn't scale. Applies to ALL selected rows, including ones
  // that already have a type (predictable "apply to selection" behavior,
  // not a surprising "only fill blanks" variant).
  const [bulkDocType, setBulkDocType] = useState('');
  const applyBulkDocType = () => {
    if (!bulkDocType || selectedPaths.length === 0) return;
    setDocTypeByPath((prev) => {
      const next = { ...prev };
      selectedPaths.forEach((path) => {
        next[path] = bulkDocType;
      });
      return next;
    });
    setGuessedPaths((prev) => {
      if (selectedPaths.every((path) => !prev.has(path))) return prev;
      const next = new Set(prev);
      selectedPaths.forEach((path) => next.delete(path));
      return next;
    });
  };

  // A selected row with no docType chosen has nowhere to sync to — block
  // proceeding until every selected row is mapped.
  const hasUnmappedSelection = selectedPaths.some((path) => !docTypeByPath[path]);

  const handleProceed = () => {
    onProceed(
      computeFilesToSkip(conflicts, newFiles, selectedPaths),
      computeDocTypeOverrides(conflicts, newFiles, selectedPaths, docTypeByPath)
    );
  };

  const renderRow = (file, { isConflict }) => {
    const isSelected = selectedSet.has(file.relativePath);
    const chosenDocType = docTypeByPath[file.relativePath] || '';
    const needsDocType = isSelected && !chosenDocType;
    const isGuessed = guessedPaths.has(file.relativePath);

    return (
      <React.Fragment key={file.relativePath}>
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          sx={{
            bgcolor: isSelected ? 'action.selected' : 'background.paper',
            pr: 1,
          }}
        >
          <ListItemButton dense onClick={() => handleToggle(file.relativePath)} sx={{ flex: 1, minWidth: 0 }}>
            <ListItemIcon>
              <Checkbox edge="start" checked={isSelected} disableRipple />
            </ListItemIcon>
            <ListItemText
              primary={`${file.relativePath}${isConflict ? ' (conflict)' : ''}`}
              secondary={
                <>
                  Created: {formatDate(file.timeCreated)} • Modified: {formatDate(file.timeLastModified)} • Size:{' '}
                  {isConflict && file.sizeChanged
                    ? `${formatBytes(file.existingSize || 0)} → ${formatBytes(file.size)}`
                    : formatBytes(file.size)}
                </>
              }
              secondaryTypographyProps={{
                color: isConflict && file.sizeChanged ? 'warning.main' : 'text.secondary',
              }}
            />
          </ListItemButton>
          <FormControl size="small" error={needsDocType} sx={{ minWidth: 150, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <InputLabel id={`doctype-label-${file.relativePath}`}>Document Type</InputLabel>
            <Select
              labelId={`doctype-label-${file.relativePath}`}
              label="Document Type"
              value={chosenDocType}
              onChange={(e) => handleDocTypeChange(file.relativePath, e.target.value)}
            >
              <MenuItem value="">
                <em>Select…</em>
              </MenuItem>
              {(documentTypes || []).map((dt) => (
                <MenuItem key={dt} value={dt}>
                  {dt}
                </MenuItem>
              ))}
            </Select>
            {isGuessed && <FormHelperText sx={{ color: 'info.main' }}>Suggested</FormHelperText>}
          </FormControl>
        </Box>
        <Divider />
      </React.Fragment>
    );
  };

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

          {scanCaveatMessage && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {scanCaveatMessage}
            </Alert>
          )}

          {hasUnmappedSelection && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Some selected files don't have a recognized document type yet — choose one for each before syncing.
            </Alert>
          )}

          {guessedPaths.size > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {guessedPaths.size} type{guessedPaths.size === 1 ? '' : 's'} were suggested from the filename — confirm
              they're right.
            </Alert>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1, gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Summary:</strong> {totalFiles} file{totalFiles === 1 ? '' : 's'} found in SharePoint —{' '}
              {selectedPaths.length} selected to sync
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="bulk-doctype-label">Assign type…</InputLabel>
                <Select
                  labelId="bulk-doctype-label"
                  label="Assign type…"
                  value={bulkDocType}
                  onChange={(e) => setBulkDocType(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select…</em>
                  </MenuItem>
                  {(documentTypes || []).map((dt) => (
                    <MenuItem key={dt} value={dt}>
                      {dt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" onClick={applyBulkDocType} disabled={!bulkDocType || selectedPaths.length === 0}>
                Apply to selected ({selectedPaths.length})
              </Button>
              <Button size="small" onClick={handleSelectAll}>
                {selectedPaths.length === allPaths.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>
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
            {orderedRows.map((row) => renderRow(row.file, { isConflict: row.isConflict }))}
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleProceed}
          variant="contained"
          color="primary"
          disabled={selectedPaths.length === 0 || hasUnmappedSelection}
        >
          Proceed with Sync ({selectedPaths.length} files)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointConflictDialog;
