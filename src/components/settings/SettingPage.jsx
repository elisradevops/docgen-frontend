import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import {
  Card,
  CardContent,
  CardHeader,
  Avatar,
  TextField,
  Button,
  Typography,
  Stack,
  InputAdornment,
  IconButton,
  Divider,
  Box,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import { makeKey, tryLocalStorageGet } from '../../utils/storage';

const SettingsPage = observer(({ login }) => {
  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedPat, setSelectedPAT] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const appTitle = 'DocGen';

  useEffect(() => {
    try {
      const namespaced = tryLocalStorageGet(makeKey('lastOrgUrl'));
      const legacy = window.localStorage.getItem('lastOrgUrl');
      const last = namespaced || legacy;
      if (last && !selectedUrl) setSelectedUrl(last);
    } catch {
      /* empty */
    }
  }, [selectedUrl]);

  const [showPat, setShowPat] = useState(false);
  const validUrl = /^https?:\/\/.+/.test((selectedUrl || '').trim());
  const pastePat = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setSelectedPAT(text.trim());
    } catch {
      // ignore
    }
  };

  const cardMaxWidth = 480;
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        width: '100vw',
        px: 2,
        overflow: 'hidden',
        bgcolor: '#f8fafc', // light base
      }}
    >
      {/* Decorative background accents */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {/* Blue accent */}
        <Box
          sx={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            bgcolor: '#1B458F',
            opacity: 0.18,
          }}
        />
        {/* Yellow accent */}
        <Box
          sx={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: '50%',
            bgcolor: '#FDE134',
            opacity: 0.18,
          }}
        />
      </Box>

      {/* App Title */}
      <Typography
        variant='h3'
        align='center'
        sx={{
          mb: 1,
          color: '#0f172a',
          fontWeight: 800,
          letterSpacing: 1,
          textShadow: 'none',
          zIndex: 1,
        }}
      >
        {appTitle}
      </Typography>
      <Typography
        variant='subtitle1'
        align='center'
        sx={{ mb: 3, color: '#334155', zIndex: 1 }}
      >
        Welcome to DocGen
      </Typography>

      <Card
        elevation={6}
        sx={{ width: '100%', maxWidth: cardMaxWidth, borderRadius: 3, zIndex: 1 }}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <LockOutlinedIcon />
            </Avatar>
          }
          title={<Typography variant='h6'>Sign in</Typography>}
          subheader={<Typography variant='body2'>Connect to Azure DevOps</Typography>}
        />
        <Divider />
        <CardContent>
          <Stack spacing={2}>
            <TextField
              name='org-url'
              label='Organization URL'
              placeholder='https://dev.azure.com/yourorg'
              value={selectedUrl}
              onChange={(e) => setSelectedUrl(e.target.value)}
              error={Boolean(selectedUrl) && !validUrl}
              helperText={
                Boolean(selectedUrl) && !validUrl
                  ? 'Enter a valid URL (must start with http:// or https://)'
                  : "We'll remember this URL for next time."
              }
              fullWidth
              required
            />

            <TextField
              label='Personal Access Token'
              placeholder='Enter Token'
              value={selectedPat}
              onChange={(e) => setSelectedPAT(e.target.value)}
              type={showPat ? 'text' : 'password'}
              fullWidth
              required
              name='pat'
              autoComplete='new-password'
              autoCapitalize='off'
              autoCorrect='off'
              spellCheck={false}
              sx={{
                // Hide native reveal/clear buttons (Edge/IE) to avoid duplicate eye icon
                '& input::-ms-reveal, & input::-ms-clear': { display: 'none' },
                // Some Chromium variants expose an autofill button
                '& input::-webkit-credentials-auto-fill-button': { display: 'none' },
              }}
              helperText={'If you get 401, your PAT may be invalid or expired.'}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position='end'>
                    <IconButton
                      aria-label='paste PAT'
                      onClick={pastePat}
                      edge='end'
                      size='small'
                    >
                      <ContentPasteRoundedIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      aria-label='toggle password visibility'
                      onClick={() => setShowPat((s) => !s)}
                      edge='end'
                      size='small'
                    >
                      {showPat ? <VisibilityOff fontSize='small' /> : <Visibility fontSize='small' />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type='submit'
              color='primary'
              variant='contained'
              fullWidth
              disabled={submitting || !validUrl || !selectedPat?.trim()}
              onClick={async () => {
                const url = (selectedUrl || '').trim();
                const pat = (selectedPat || '').trim();
                if (!url || !pat) return;
                try {
                  setSubmitting(true);
                  await login(url, pat);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
});

export default SettingsPage;
