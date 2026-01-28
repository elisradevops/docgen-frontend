import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import C from '../../store/constants';
import { getLastApiError } from '../../utils/debug';

const parseDebugFlag = () => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('debug');
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
};

const normalizeProjectName = (value) => {
  let raw = String(value || '').trim();
  if (!raw) return '';
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(raw)) break;
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded === raw) break;
      raw = decoded;
    } catch {
      break;
    }
  }
  raw = raw.replace(/[\u00a0\u200b\u200c\u200d\uFEFF]/g, ' ');
  raw = raw.replace(/\s+/g, ' ').trim();
  return raw;
};

const DebugPanel = ({ store, adoContext }) => {
  const enabled = useMemo(() => parseDebugFlag(), []);
  const [open, setOpen] = useState(enabled);
  const [lastError, setLastError] = useState(() => getLastApiError());
  const normalizedProjectName = normalizeProjectName(adoContext?.project?.name || '');

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (event) => {
      setLastError(event?.detail || getLastApiError());
    };
    window.addEventListener('docgen:debug-error', handler);
    return () => window.removeEventListener('docgen:debug-error', handler);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 2000,
        maxWidth: 360,
      }}
    >
      <Stack
        spacing={1}
        alignItems='flex-end'
      >
        <Button
          variant='contained'
          color='secondary'
          size='small'
          onClick={() => setOpen((v) => !v)}
        >
          Debug
        </Button>
        {open ? (
          <Paper
            elevation={8}
            sx={{
              p: 2,
              borderRadius: 2,
              width: '100%',
              maxHeight: 360,
              overflow: 'auto',
            }}
          >
            <Typography
              variant='subtitle1'
              sx={{ fontWeight: 700 }}
            >
              Debug Panel
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Stack
              spacing={0.75}
              sx={{ fontSize: 13 }}
            >
              <Typography variant='body2'>API Base URL: {C.jsonDocument_url}</Typography>
              <Typography variant='body2'>Collection URL: {adoContext?.collectionUri || 'n/a'}</Typography>
              <Typography variant='body2'>ADO Project: {normalizedProjectName || 'n/a'}</Typography>
              <Typography variant='body2'>
                Access Token: {adoContext?.accessToken ? 'present' : 'missing'}
              </Typography>
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
};

export default DebugPanel;
