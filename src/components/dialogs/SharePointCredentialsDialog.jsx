import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
} from '@mui/material';
import { toast } from 'react-toastify';
import { loginWithSharePointOAuth } from '../../utils/sharepointOAuth';

const SharePointCredentialsDialog = ({ open, onClose, onSubmit, siteUrl }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load credentials from sessionStorage if available
  useEffect(() => {
    if (open) {
      const storedCreds = sessionStorage.getItem('sharepoint_credentials');
      if (storedCreds) {
        try {
          const creds = JSON.parse(storedCreds);
          setUsername(creds.username || '');
          setDomain(creds.domain || '');
          setRememberCredentials(true);

          // Auto-fill password if stored (for seamless re-authentication)
          if (creds.password) {
            try {
              setPassword(atob(creds.password)); // Decode from base64
            } catch {
              // If decoding fails, leave password empty
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, [open]);

  const isSharePointOnline = (url) => {
    return url && url.toLowerCase().includes('.sharepoint.com');
  };

  const handleOAuthLogin = async () => {
    setLoading(true);

    try {
      // Use true SPA OAuth flow (frontend handles everything)
      const token = await loginWithSharePointOAuth(siteUrl);

      // Cache the OAuth token for 1 hour
      sessionStorage.setItem(
        'sharepoint_oauth_token',
        JSON.stringify({
          ...token,
          timestamp: Date.now(),
        })
      );

      // Success toast will be shown by parent component after sync completes
      onSubmit(token);
      onClose();
    } catch (error) {
      toast.error(`Authentication failed: ${error.message}`, { autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      // Check if this is SharePoint Online
      if (isSharePointOnline(siteUrl)) {
        // SharePoint Online requires OAuth - show error
        toast.error(
          'SharePoint Online requires OAuth authentication. Please use "Login with Microsoft" button.',
          { autoClose: 6000 }
        );
        setLoading(false);
        return;
      }

      // On-premise SharePoint - use NTLM credentials
      const credentials = {
        username: username.trim(),
        password: password,
        domain: domain.trim(),
      };

      // Save to sessionStorage if user wants to remember
      if (rememberCredentials) {
        sessionStorage.setItem(
          'sharepoint_credentials',
          JSON.stringify({
            username: username.trim(),
            password: btoa(password),
            domain: domain.trim(),
            timestamp: Date.now(),
          })
        );
      } else {
        sessionStorage.removeItem('sharepoint_credentials');
      }

      onSubmit(credentials);
      onClose();
    } catch (error) {
      toast.error(`Authentication failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
    >
      <DialogTitle>Enter SharePoint Credentials</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {isSharePointOnline(siteUrl) ? (
            <>
              <Alert
                severity='info'
                sx={{ mb: 2 }}
              >
                <Typography variant='body2'>
                  <strong>SharePoint Online Detected</strong>
                  <br />
                  For accounts with MFA enabled, use "Login with Microsoft" button below.
                </Typography>
              </Alert>

              <Button
                fullWidth
                variant='contained'
                color='primary'
                onClick={handleOAuthLogin}
                disabled={loading}
                startIcon={
                  loading && (
                    <CircularProgress
                      size={16}
                      color='inherit'
                    />
                  )
                }
                sx={{ mb: 3, py: 1.5 }}
              >
                {loading ? 'Opening Microsoft Login...' : '🔐 Login with Microsoft (Supports MFA)'}
              </Button>

              <Typography
                variant='body2'
                align='center'
                color='text.secondary'
                sx={{ mb: 2 }}
              >
                - OR enter credentials manually -
              </Typography>
            </>
          ) : (
            <Alert
              severity='info'
              sx={{ mb: 2 }}
            >
              <Typography variant='body2'>
                <strong>💡 Tip:</strong> These are typically the same credentials you use for TFS/Azure
                DevOps.
                <br />
                Check "Remember" below to avoid entering them again this session (8 hours).
              </Typography>
            </Alert>
          )}

          <TextField
            fullWidth
            label='Username *'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={isSharePointOnline(siteUrl) ? 'user@company.com' : 'john.doe'}
            helperText={isSharePointOnline(siteUrl) ? 'Your Microsoft 365 email' : 'Your Windows username'}
            sx={{ mb: 2 }}
            autoFocus
            onKeyPress={handleKeyPress}
          />

          <TextField
            fullWidth
            type='password'
            label='Password *'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
            onKeyPress={handleKeyPress}
          />

          {!isSharePointOnline(siteUrl) && (
            <TextField
              fullWidth
              label='Domain (Optional)'
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder='COMPANY'
              helperText='Your Windows domain (if applicable)'
              sx={{ mb: 2 }}
              onKeyPress={handleKeyPress}
            />
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
              />
            }
            label='Remember credentials for this session (8 hours, not saved after browser closes)'
          />

          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ display: 'block', mt: 2 }}
          >
            Your credentials are only used to authenticate with SharePoint. They are not stored on the server.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant='contained'
          color='primary'
          disabled={loading}
          startIcon={
            loading && (
              <CircularProgress
                size={16}
                color='inherit'
              />
            )
          }
        >
          {loading ? 'Authenticating...' : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointCredentialsDialog;
