import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { toast } from 'react-toastify';
import {
  getAllSharePointConfigs,
  deleteSharePointConfig,
} from '../../store/data/docManagerApi';
import SharePointConfigDialog from './SharePointConfigDialog';
import logger from '../../utils/logger';

const SharePointConfigManager = ({ open, onClose, userId, currentProject }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);

  const loadConfigs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await getAllSharePointConfigs(userId);
      if (result.success) {
        setConfigs(result.configs || []);
      }
    } catch (error) {
      toast.error(`Failed to load configurations: ${error.message}`);
      logger.error('Failed to load SharePoint configs:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) {
      loadConfigs();
    }
  }, [open, loadConfigs]);

  const handleAddNew = () => {
    setEditingConfig(null);
    setShowConfigDialog(true);
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setShowConfigDialog(true);
  };

  const handleDelete = (config) => {
    setConfigToDelete(config);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!configToDelete) return;

    try {
      const result = await deleteSharePointConfig(userId, configToDelete.projectName);
      if (result.success) {
        toast.success(`Configuration for "${configToDelete.projectName}" deleted`);
        loadConfigs();
      } else {
        toast.error('Failed to delete configuration');
      }
    } catch (error) {
      toast.error(`Failed to delete: ${error.message}`);
      logger.error('Failed to delete SharePoint config:', error);
    } finally {
      setShowDeleteDialog(false);
      setConfigToDelete(null);
    }
  };

  const handleConfigSaved = async (config) => {
    try {
      const { saveSharePointConfig } = await import('../../store/data/docManagerApi');
      
      // Use the projectName from editing config or from the new config
      const projectName = editingConfig?.projectName || config.projectName;
      
      if (!projectName) {
        toast.error('Project name is required');
        return;
      }

      await saveSharePointConfig(
        userId,
        projectName,
        config.siteUrl,
        config.library,
        config.folder,
        config.displayName
      );

      setShowConfigDialog(false);
      setEditingConfig(null);
      loadConfigs();
      toast.success('Configuration saved successfully');
    } catch (error) {
      toast.error(`Failed to save configuration: ${error.message}`);
      logger.error('Failed to save SharePoint config:', error);
    }
  };

  const getShortUrl = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Manage SharePoint Configurations</span>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddNew}
              size="small"
            >
              Add New
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>Loading configurations...</Typography>
            </Box>
          ) : configs.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No SharePoint configurations found. Click "Add New" to create your first configuration.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Project</strong></TableCell>
                    <TableCell><strong>Display Name</strong></TableCell>
                    <TableCell><strong>SharePoint Location</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow 
                      key={config.projectName}
                      sx={{ 
                        backgroundColor: config.projectName === currentProject ? 'action.selected' : 'inherit',
                      }}
                    >
                      <TableCell>
                        <strong>{config.projectName}</strong>
                        {config.projectName === currentProject && (
                          <Chip label="Current" color="primary" size="small" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {config.displayName || <em style={{ color: 'gray' }}>Not set</em>}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {getShortUrl(config.siteUrl)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {config.library} → {config.folder}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label="Configured" 
                          color="success" 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Edit configuration">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEdit(config)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete configuration">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(config)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {showConfigDialog && (
        <SharePointConfigDialog
          open={showConfigDialog}
          onClose={() => {
            setShowConfigDialog(false);
            setEditingConfig(null);
          }}
          onSubmit={handleConfigSaved}
          initialConfig={editingConfig}
          userId={userId}
          showProjectName={true}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setConfigToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete SharePoint Configuration?</DialogTitle>
        <DialogContent>
          {configToDelete && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete the SharePoint configuration for <strong>"{configToDelete.projectName}"</strong>?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>This will remove:</strong>
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  <li>{configToDelete.displayName || configToDelete.siteUrl}</li>
                  <li>{configToDelete.library}/{configToDelete.folder}</li>
                </Box>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowDeleteDialog(false);
              setConfigToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SharePointConfigManager;
