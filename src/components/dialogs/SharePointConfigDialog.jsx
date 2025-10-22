import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { getAllSharePointConfigs } from '../../store/data/docManagerApi';
import logger from '../../utils/logger';

const SharePointConfigDialog = ({ open, onClose, onSubmit, userId, initialConfig, showProjectName = false }) => {
  const [siteUrl, setSiteUrl] = useState('');
  const [library, setLibrary] = useState('Shared Documents');
  const [folder, setFolder] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('');

  // Pre-fill fields when editing existing config
  useEffect(() => {
    if (initialConfig) {
      setSiteUrl(initialConfig.siteUrl || '');
      setLibrary(initialConfig.library || 'Shared Documents');
      setFolder(initialConfig.folder || '');
      setDisplayName(initialConfig.displayName || '');
      setProjectName(initialConfig.projectName || '');
    } else {
      // Reset fields when creating new config
      setSiteUrl('');
      setLibrary('Shared Documents');
      setFolder('');
      setDisplayName('');
      setProjectName('');
      setSelectedConfig('');
    }
  }, [initialConfig, open]);

  // Load saved configurations
  useEffect(() => {
    const loadSavedConfigs = async () => {
      try {
        const result = await getAllSharePointConfigs(userId);
        if (result.success && result.configs) {
          setSavedConfigs(result.configs);
        }
      } catch (error) {
        logger.error('Failed to load saved SharePoint configs:', error);
      }
    };

    if (open && userId) {
      loadSavedConfigs();
    }
  }, [open, userId]);

  const handleSelectConfig = (configId) => {
    setSelectedConfig(configId);
    const config = savedConfigs.find((c) => c.id === configId);
    if (config) {
      setSiteUrl(config.siteUrl);
      setLibrary(config.library);
      setFolder(config.folder);
      setDisplayName(config.displayName || '');
    }
  };

  const handleReset = () => {
    setSiteUrl('');
    setLibrary('Shared Documents');
    setFolder('');
    setDisplayName('');
    setSelectedConfig('');
  };

  const handleSubmit = () => {
    if (!siteUrl || !library || !folder) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate projectName if required
    if (showProjectName && !projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    // Validate SharePoint URL format
    try {
      new URL(siteUrl);
    } catch {
      toast.error('Please enter a valid SharePoint URL (e.g., http://sharepoint-server/sites/project)');
      return;
    }

    const config = {
      siteUrl: siteUrl.trim(),
      library: library.trim(),
      folder: folder.trim(),
      displayName: displayName.trim() || `${siteUrl}/${library}/${folder}`,
      ...(showProjectName && { projectName: projectName.trim() }),
    };

    onSubmit(config);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Configure SharePoint Location</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter the SharePoint location where your templates are stored. This configuration will be
            saved for future use.
          </Alert>

          {savedConfigs.length > 0 && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Load Saved Configuration</InputLabel>
              <Select
                value={selectedConfig}
                onChange={(e) => handleSelectConfig(e.target.value)}
                label="Load Saved Configuration"
              >
                <MenuItem value="">
                  <em>New Configuration</em>
                </MenuItem>
                {savedConfigs.map((config) => (
                  <MenuItem key={config.id} value={config.id}>
                    {config.displayName || `${config.siteUrl}/${config.library}/${config.folder}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {showProjectName && (
            <TextField
              fullWidth
              label="Project Name *"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-project"
              helperText="Azure DevOps project name for this configuration"
              sx={{ mb: 2 }}
              disabled={!!initialConfig}
            />
          )}

          <TextField
            fullWidth
            label="SharePoint URL *"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="http://sharepoint-server/sites/project-name"
            helperText="Full URL to your SharePoint site (e.g., http://elis-prd-spapp/sites/elisradevops-project)"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Document Library *"
            value={library}
            onChange={(e) => setLibrary(e.target.value)}
            placeholder="Shared Documents"
            helperText="Name of the document library containing templates"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Folder Path *"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="02 Engineering/Templates"
            helperText="Path to the parent templates folder (subfolders like STD, SRS will be scanned automatically)"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Display Name (Optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="My SharePoint Templates"
            helperText="Friendly name for this configuration"
            sx={{ mb: 2 }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            <strong>Example for your environment:</strong>
            <br />
            URL: http://elis-prd-spapp/sites/elisradevops-project
            <br />
            Library: Shared Documents
            <br />
            Folder: 02 Engineering/SFTP and DTS/Templates
            <br />
            <br />
            <strong>Note:</strong> Subfolders (STD, SRS, STR, etc.) will be scanned automatically and files will be organized by document type.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset}>
          Reset
        </Button>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointConfigDialog;
