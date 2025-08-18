import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Button,
  Checkbox,
  IconButton,
  Tooltip,
  Typography,
  Box,
} from '@mui/material';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';

const defaultFormattingSettings = {
  trimAdditionalSpacingInDescriptions: false,
  trimAdditionalSpacingInTables: false,
  processVoidList: false,
};

const FormattingSettingsDialog = ({ store }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [formattingSettings, setFormattingSettings] = useState(defaultFormattingSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize settings from store when dialog opens
  useEffect(() => {
    if (openDialog && store.formattingSettings) {
      setFormattingSettings(store.formattingSettings);
      setHasChanges(false);
    }
  }, [openDialog, store.formattingSettings]);

  // Generic handler for checkbox changes - more performant and DRY
  const handleSettingChange = useCallback(
    (settingKey) => (event) => {
      const newValue = event.target.checked;
      setFormattingSettings((prev) => {
        const updated = { ...prev, [settingKey]: newValue };
        setHasChanges(
          JSON.stringify(updated) !== JSON.stringify(store.formattingSettings || defaultFormattingSettings)
        );
        return updated;
      });
    },
    [store.formattingSettings]
  );

  const handleOpen = useCallback(() => {
    setOpenDialog(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpenDialog(false);
    setHasChanges(false);
  }, []);

  const handleSave = useCallback(() => {
    store.setFormattingSettings(formattingSettings);
    setOpenDialog(false);
    setHasChanges(false);
  }, [store, formattingSettings]);

  const handleCancel = useCallback(() => {
    if (store.formattingSettings) {
      setFormattingSettings(store.formattingSettings);
    } else {
      setFormattingSettings(defaultFormattingSettings);
    }
    setOpenDialog(false);
    setHasChanges(false);
  }, [store.formattingSettings]);

  // Memoized settings configuration for better maintainability
  const settingsConfig = useMemo(
    () => [
      {
        key: 'trimAdditionalSpacingInDescriptions',
        label: 'Trim additional spacing in descriptions',
        description: 'Reduces extra whitespace and line breaks in description content',
      },
      {
        key: 'trimAdditionalSpacingInTables',
        label: 'Trim additional spacing in tables',
        description: 'Applies tighter spacing to table cells for more compact layout',
      },
      {
        key: 'processVoidList',
        label: 'Process Void List',
        description: 'Processes the void list in the document',
      },
    ],
    []
  );
  return (
    <>
      <Tooltip
        title='Format Settings'
        placement='top'
      >
        <IconButton
          aria-label='format-settings'
          color='info'
          onClick={handleOpen}
          size='small'
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Dialog
        open={openDialog}
        onClose={handleClose}
        maxWidth='sm'
        fullWidth
        aria-labelledby='formatting-settings-title'
        aria-describedby='formatting-settings-description'
      >
        <DialogTitle id='formatting-settings-title'>Document Formatting Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='body2'
              color='text.secondary'
              id='formatting-settings-description'
            >
              Configure how spacing and formatting are applied to your generated documents.
            </Typography>
          </Box>
          <Grid
            container
            spacing={3}
          >
            {settingsConfig.map((setting) => (
              <Grid
                item
                xs={12}
                key={setting.key}
              >
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formattingSettings[setting.key] || false}
                        onChange={handleSettingChange(setting.key)}
                        color='primary'
                      />
                    }
                    label={
                      <Box>
                        <Typography
                          variant='body1'
                          component='span'
                        >
                          {setting.label}
                        </Typography>
                        <Typography
                          variant='body2'
                          color='text.secondary'
                          component='div'
                          sx={{ mt: 0.5 }}
                        >
                          {setting.description}
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', mb: 1 }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCancel}
            color='inherit'
            variant='outlined'
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            color='primary'
            variant='contained'
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FormattingSettingsDialog;
