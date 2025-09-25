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
  Collapse,
  Link,
} from '@mui/material';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const defaultFormattingSettings = {
  trimAdditionalSpacingInDescriptions: false,
  trimAdditionalSpacingInTables: false,
  processVoidList: false,
};

const FormattingSettingsDialog = ({ store }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [formattingSettings, setFormattingSettings] = useState(defaultFormattingSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [expanded, setExpanded] = useState({});

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

  const toggleDescription = useCallback(
    (settingKey) => () =>
      setExpanded((prev) => ({
        ...prev,
        [settingKey]: !prev[settingKey],
      })),
    []
  );

  const handleOpen = useCallback(() => {
    setOpenDialog(true);
    // Reset expanded sections on each open
    setExpanded({});
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
        collapsible: true,
        summary: 'Parses #VL-XX {content}# and exports an Excel file + validation report.',
        description: (
          <Box
            component='ul'
            sx={{
              pl: 3,
              m: 0,
              typography: 'body2',
              color: 'text.secondary',
              '& li': { mb: 0.5 },
              '& code': {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '0.85em',
              },
            }}
          >
            <li>
              Processes Void List patterns of “#VL-XX <code>{'{content}'}</code>#”, where XX is a valid
              number.
            </li>
            <li>
              When enabled, creates an Excel file where the key is the VL-XX code and the value is the{' '}
              <code>{'{content}'}</code>.
            </li>
            <li>
              Generates a validation report for issues: invalid codes (non-whole numbers) and duplicates
              (allowed; adds a warning and appends a following index).
            </li>
          </Box>
        ),
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
                size={12}
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
                        {setting.collapsible ? (
                          <>
                            <Box sx={{ mt: 0.5 }}>
                              <Link
                                component='button'
                                underline='hover'
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleDescription(setting.key)();
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                }}
                                aria-expanded={!!expanded[setting.key]}
                                aria-controls={`${setting.key}-details`}
                                sx={{
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  p: 0,
                                }}
                              >
                                {expanded[setting.key] ? (
                                  <>
                                    <ExpandLessIcon
                                      fontSize='small'
                                      sx={{ mr: 0.5 }}
                                    />{' '}
                                    Hide details
                                  </>
                                ) : (
                                  <>
                                    <ExpandMoreIcon
                                      fontSize='small'
                                      sx={{ mr: 0.5 }}
                                    />{' '}
                                    Show details
                                  </>
                                )}
                              </Link>
                            </Box>
                            {!expanded[setting.key] && setting.summary ? (
                              <Typography
                                variant='body2'
                                color='text.secondary'
                                component='div'
                                sx={{ mt: 0.5 }}
                              >
                                {setting.summary}
                              </Typography>
                            ) : null}
                          </>
                        ) : (
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            component='div'
                            sx={{ mt: 0.5 }}
                          >
                            {setting.description}
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', mb: 1 }}
                  />
                  {setting.collapsible ? (
                    <Collapse in={!!expanded[setting.key]}>
                      <Typography
                        id={`${setting.key}-details`}
                        variant='body2'
                        color='text.secondary'
                        component='div'
                        sx={{ mt: 0.5, ml: 6 }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {setting.description}
                      </Typography>
                    </Collapse>
                  ) : null}
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
