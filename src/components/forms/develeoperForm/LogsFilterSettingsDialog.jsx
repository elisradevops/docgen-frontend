import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { Select as AntSelect, Tag as AntTag } from 'antd';
import { LOGS_FILTER_DEFAULTS, loadLogsFilterSettings, saveLogsFilterSettings } from './logsFilterSettings';

const WINDOW_OPTIONS = [
  { label: 'Last hour', value: 1 },
  { label: 'Last 24 hours', value: 24 },
  { label: 'Last 7 days', value: 168 },
  { label: 'Last 30 days', value: 720 },
];

const LEVEL_COLOR = { error: '#D1434B', warn: '#ED6C02', info: '#94a3b8', debug: '#64748b' };
const LEVEL_OPTIONS = ['error', 'warn', 'info', 'debug'].map((l) => ({ label: l.toUpperCase(), value: l }));

const levelTagRender = ({ label, value, closable, onClose }) => (
  <AntTag
    color={LEVEL_COLOR[value]}
    closable={closable}
    onClose={onClose}
    style={{ marginInlineEnd: 4, fontWeight: 700 }}
  >
    {label}
  </AntTag>
);

const SectionLabel = ({ children }) => (
  <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.5 }}>
    {children}
  </Typography>
);

const HintText = ({ children }) => (
  <Typography variant='caption' color='text.secondary'>
    {children}
  </Typography>
);

// Renders Antd Select dropdowns inside the dialog DOM node so they stack above it.
const popupInParent = (triggerNode) => triggerNode.parentElement;

/**
 * Gear-icon trigger + Dialog for persisted LogsExplorer display preferences.
 * Covers: default time window and default level filter.
 * Exclude phrases live directly in the toolbar for immediate apply (no dialog needed).
 */
const LogsFilterSettingsDialog = ({ onSave, availableServices = [] }) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(LOGS_FILTER_DEFAULTS);

  useEffect(() => {
    if (open) setSettings(loadLogsFilterSettings());
  }, [open]);

  const set = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    setSettings((latest) => {
      saveLogsFilterSettings(latest);
      onSave(latest);
      return latest;
    });
    setOpen(false);
  };

  return (
    <>
      <Tooltip title='Display settings'>
        <IconButton size='small' onClick={() => setOpen(true)}>
          <SettingsIcon fontSize='small' />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Log Display Settings</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            {/* ── Defaults ──────────────────────────────────── */}
            <div>
              <SectionLabel>Defaults on open</SectionLabel>
              <HintText>Applied each time you open the Logs Explorer.</HintText>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <Stack direction='row' spacing={2}>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant='caption'>Time window</Typography>
                    <AntSelect
                      value={settings.defaultWindowHours}
                      onChange={(v) => set('defaultWindowHours', v)}
                      options={WINDOW_OPTIONS}
                      style={{ width: '100%' }}
                      getPopupContainer={popupInParent}
                    />
                  </Stack>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant='caption'>Default levels (empty = all)</Typography>
                  <AntSelect
                    mode='multiple'
                    value={settings.defaultLevels}
                    onChange={(v) => set('defaultLevels', v)}
                    options={LEVEL_OPTIONS}
                    style={{ width: '100%' }}
                    placeholder='All levels'
                    getPopupContainer={popupInParent}
                    tagRender={levelTagRender}
                    optionRender={(option) => (
                      <span style={{ color: LEVEL_COLOR[option.value], fontWeight: 700 }}>
                        {option.label}
                      </span>
                    )}
                  />
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant='caption'>Default services (empty = all)</Typography>
                  <AntSelect
                    mode='multiple'
                    value={settings.defaultServices}
                    onChange={(v) => set('defaultServices', v)}
                    options={availableServices.map((s) => ({ label: s, value: s }))}
                    style={{ width: '100%' }}
                    placeholder='All services'
                    getPopupContainer={popupInParent}
                    allowClear
                  />
                </Stack>
              </Stack>
            </div>

            <Divider />

            {/* ── Exclude phrases ───────────────────────────── */}
            <div>
              <SectionLabel>Exclude phrases</SectionLabel>
              <HintText>
                Rows whose message contains any of these substrings are hidden. Case-insensitive.
                Type a phrase and press Enter or comma to add.
              </HintText>
              <AntSelect
                mode='tags'
                value={settings.excludePhrases}
                onChange={(v) => set('excludePhrases', v)}
                style={{ width: '100%', marginTop: 8 }}
                placeholder='e.g. Executing action, Request finished…'
                tokenSeparators={[',']}
                allowClear
              />
            </div>

          </Stack>
        </DialogContent>

        <DialogActions>
          <Button size='small' color='inherit' onClick={() => setSettings({ ...LOGS_FILTER_DEFAULTS })}>
            Reset to defaults
          </Button>
          <Button size='small' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size='small' variant='contained' onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LogsFilterSettingsDialog;
