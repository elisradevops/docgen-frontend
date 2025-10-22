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
  Alert,
  AlertTitle,
  Collapse,
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import { makeKey, tryLocalStorageGet } from '../../utils/storage';

const SettingsPage = observer(({ login }) => {
  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedPat, setSelectedPAT] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const appTitle = 'DocGen';

  useEffect(() => {
    try {
      const namespaced = tryLocalStorageGet(makeKey('lastOrgUrl'));
      const legacy = window.localStorage.getItem('lastOrgUrl');
      const last = namespaced || legacy;
      if (last) setSelectedUrl(last);
    } catch {
      /* empty */
    }
  }, []); // Only run once on mount

  const [showPat, setShowPat] = useState(false);

  // Validate organization URL format
  const validateOrgUrl = (url) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return { valid: false, message: '' };

    // Must start with http:// or https://
    if (!/^https?:\/\/.+/.test(trimmed)) {
      return { valid: false, message: 'URL must start with http:// or https://' };
    }

    // Remove trailing slashes for validation
    const normalized = trimmed.replace(/\/+$/, '');

    // Cloud patterns: https://{domain}/{collection}
    const cloudPattern = /^https:\/\/[^/]+\/[^/]+$/;

    // On-premise patterns: (http|https)://{domain}/tfs/{collection} (case-insensitive)
    const onPremisePattern = /^https?:\/\/[^/]+(:\d+)?\/tfs\/[^/]+$/i;

    // Check if URL has /tfs/ in it
    const hasTfsPath = /\/tfs\//i.test(normalized);

    // If it has /tfs/, validate as on-premise
    if (hasTfsPath) {
      if (onPremisePattern.test(normalized)) {
        return { valid: true, message: '' };
      }
      // Invalid on-premise format
      return {
        valid: false,
        message: 'Invalid on-premise URL format. Expected: http(s)://{domain}/tfs/{collection}',
      };
    }

    // No /tfs/ path, validate as cloud
    if (cloudPattern.test(normalized)) {
      return { valid: true, message: '' };
    }

    // Check if user added extra path segments (like project name)
    const hasExtraSegments =
      normalized.split('/').length > 4 || (normalized.includes('/tfs/') && normalized.split('/').length > 5);

    if (hasExtraSegments) {
      return {
        valid: false,
        message:
          'URL should only include the collection, not project names. Remove any path after the collection.',
      };
    }

    // Generic error for other invalid formats
    return {
      valid: false,
      message:
        'Invalid URL format. Cloud: https://{domain}/{collection} or On-Premise: http(s)://{domain}/tfs/{collection}',
    };
  };

  const urlValidation = validateOrgUrl(selectedUrl);
  const validUrl = urlValidation.valid;

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
              label='Organization URL (Collection)'
              placeholder='https://dev.azure.com/yourorg'
              value={selectedUrl}
              onChange={(e) => setSelectedUrl(e.target.value)}
              error={Boolean(selectedUrl) && !validUrl}
              helperText={
                Boolean(selectedUrl) && !validUrl
                  ? urlValidation.message
                  : "The 'yourorg' part in the URL is your Collection name. We'll remember this URL for next time."
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
              helperText={error ? ' ' : 'Your Personal Access Token from Azure DevOps'}
              error={Boolean(error)}
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

            {error && (
              <Alert
                severity='error'
                onClose={() => setError(null)}
              >
                <AlertTitle>Authentication Failed</AlertTitle>
                {error.status === 401 ? (
                  <>
                    <Typography
                      variant='body2'
                      gutterBottom
                    >
                      Your Personal Access Token is invalid or expired.
                    </Typography>
                    <Link
                      component='button'
                      variant='body2'
                      onClick={() => setShowGuide(!showGuide)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        mt: 1,
                        cursor: 'pointer',
                      }}
                    >
                      How to create a new PAT
                      <ExpandMoreIcon
                        sx={{
                          ml: 0.5,
                          transform: showGuide ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </Link>
                    <Collapse in={showGuide}>
                      <Box sx={{ mt: 2 }}>
                        <Typography
                          variant='body2'
                          fontWeight='bold'
                          gutterBottom
                        >
                          Steps to create a Personal Access Token:
                        </Typography>
                        <Box
                          component='ol'
                          sx={{ pl: 2.5, mt: 1, mb: 0 }}
                        >
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              Go to your Azure DevOps organization
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              Click on your profile icon (top right) → <strong>Security</strong>
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              In the Security page, find the Personal Access Tokens section and click{' '}
                              <strong>+ New Token</strong>
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              Enter a name (e.g., "DocGen")
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              Select your <strong>Organization</strong> (Collection) from the dropdown
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              Set expiration date (e.g., 30 days)
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              For <strong>Scopes</strong>, select either:
                              <br />• <strong>Full access</strong>, or
                              <br />• <strong>Custom defined</strong> with at least: Work Items (Read), Code
                              (Read)
                            </Typography>
                          </li>
                          <li>
                            <Typography
                              variant='body2'
                              sx={{ mb: 1 }}
                            >
                              Click <strong>Create</strong>
                            </Typography>
                          </li>
                          <li>
                            <Typography variant='body2'>
                              <strong>Copy the token immediately</strong> (you won't be able to see it again)
                              and paste it above
                            </Typography>
                          </li>
                        </Box>
                      </Box>
                    </Collapse>
                  </>
                ) : error.status === 404 ? (
                  <Typography variant='body2'>
                    Organization URL not found. Please verify:
                    <br />
                    • The URL is correct and accessible
                    <br />
                    • You're using the collection URL (not a project URL)
                    <br />• For cloud: <code>https://&#123;domain&#125;/&#123;collection&#125;</code>
                    <br />• For on-premise: <code>http(s)://&#123;domain&#125;/tfs/&#123;collection&#125;</code>
                  </Typography>
                ) : error.status === 502 ? (
                  <Typography variant='body2'>
                    Cannot reach the organization URL. Please verify:
                    <br />
                    • The URL is correct and accessible from your network
                    <br />
                    • You're connected to the correct VPN (for on-premise servers)
                    <br />
                    • The server hostname can be resolved
                  </Typography>
                ) : (
                  <Typography variant='body2'>
                    {error.message || `Error ${error.status || ''}: Unable to authenticate`}
                  </Typography>
                )}
              </Alert>
            )}

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
                  setError(null);
                  await login(url, pat);
                } catch (err) {
                  // Capture login errors
                  setError({
                    status: err?.response?.status || err?.status,
                    message: err?.response?.data?.message || err?.message,
                  });
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
