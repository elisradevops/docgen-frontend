import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Link,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { resolveSharePointUrl, listSharePointFiles } from '../../store/data/docManagerApi';
import { decodeJwtExpirySeconds, formatTokenExpiry } from '../../utils/graphToken';
import { resolveIdentityPrefill } from './sharePointIdentityPrefill';
import { isOnlineSharePointUrl as isOnlineUrl } from '../../utils/sharePointConnectionHealth';

const MODE_ONPREM = 'onprem';
const MODE_ONLINE = 'online';

/**
 * Single "Connect to SharePoint" dialog — replaces the old two-step
 * SharePointConfigDialog -> SharePointCredentialsDialog handoff. One mode
 * tab switch (On-premises / Online), only the active mode's fields shown,
 * a live "Test Connection" preview (reusing the real listTemplateFiles
 * backend call, so the same file filtering/validation applies here as at
 * sync time) that must succeed before "Connect & Sync" is enabled.
 */
const SharePointConnectDialog = ({ open, onClose, onConnect, initialConfig, identityHint, canSync = true }) => {
  const [mode, setMode] = useState(MODE_ONPREM);

  // On-premises — paste-a-URL is the primary path; manual 3-field entry is
  // a fallback in case a given farm doesn't resolve GET .../_api/web the
  // way this relies on.
  const [folderUrl, setFolderUrl] = useState('');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [manualSiteUrl, setManualSiteUrl] = useState('');
  const [manualLibrary, setManualLibrary] = useState('Shared Documents');
  const [manualFolder, setManualFolder] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(false);

  // Online
  const [shareLink, setShareLink] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null); // { status: 'success'|'warning'|'error', message, files, resolvedConfig }

  useEffect(() => {
    if (!open) return;
    setMode(initialConfig && isOnlineUrl(initialConfig.siteUrl) ? MODE_ONLINE : MODE_ONPREM);
    setDisplayName(initialConfig?.displayName || '');
    setPreview(null);
    if (initialConfig && !isOnlineUrl(initialConfig.siteUrl)) {
      setManualSiteUrl(initialConfig.siteUrl || '');
      setManualLibrary(initialConfig.library || 'Shared Documents');
      setManualFolder(initialConfig.folder || '');
    }
    if (initialConfig && isOnlineUrl(initialConfig.siteUrl)) {
      setShareLink(initialConfig.siteUrl || '');
    }
  }, [open, initialConfig]);

  // Separate from the reset effect above — the identity hint resolves
  // asynchronously (a network call fired from TemplatesTab) and may land
  // after the dialog is already open. Deliberately does NOT call
  // resetForNewCheck() — that would silently wipe a successful "Test
  // Connection" result if the hint resolves mid-flow.
  //
  // Applied ONCE per dialog-open (guarded by prefillAppliedRef), not on
  // every keystroke — otherwise username/domain being in the dep array
  // means backspacing the field to empty immediately re-fills it from the
  // hint, making it impossible to clear.
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    if (!open) prefillAppliedRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || !identityHint || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    const next = resolveIdentityPrefill({ hint: identityHint, username, domain });
    if (next.username !== username) setUsername(next.username);
    if (next.domain !== domain) setDomain(next.domain);
  }, [open, identityHint, username, domain]);

  const tokenExpirySeconds = accessToken ? decodeJwtExpirySeconds(accessToken.trim()) : null;
  const tokenExpiryLabel = formatTokenExpiry(tokenExpirySeconds);

  const resetForNewCheck = () => setPreview(null);

  const handleTestConnection = async () => {
    setChecking(true);
    setPreview(null);

    try {
      if (mode === MODE_ONLINE) {
        if (!shareLink.trim()) throw new Error('Paste a SharePoint/OneDrive folder link');
        if (!accessToken.trim()) throw new Error('Paste a Microsoft Graph access token');

        const auth = { accessToken: accessToken.trim() };
        const result = await listSharePointFiles(shareLink.trim(), '', '', auth);
        applyPreview(result, { siteUrl: shareLink.trim(), library: '', folder: '' });
        return;
      }

      // On-premises
      if (!username.trim() || !password) throw new Error('Enter both username and password');

      const credentials = { username: username.trim(), password, domain: domain.trim() };

      if (useManualEntry) {
        if (!manualSiteUrl.trim() || !manualLibrary.trim() || !manualFolder.trim()) {
          throw new Error('Fill in Site URL, Library, and Folder');
        }
        const config = { siteUrl: manualSiteUrl.trim(), library: manualLibrary.trim(), folder: manualFolder.trim() };
        const result = await listSharePointFiles(config.siteUrl, config.library, config.folder, credentials);
        applyPreview(result, config);
      } else {
        if (!folderUrl.trim()) throw new Error('Paste the templates folder URL');
        const resolved = await resolveSharePointUrl(folderUrl.trim(), credentials);
        if (!resolved.success) throw new Error(resolved.message || 'Could not resolve this URL');
        const config = { siteUrl: resolved.siteUrl, library: resolved.library, folder: resolved.folder };
        const result = await listSharePointFiles(config.siteUrl, config.library, config.folder, credentials);
        applyPreview(result, config);
      }
    } catch (error) {
      setPreview({ status: 'error', message: error.message });
    } finally {
      setChecking(false);
    }
  };

  const applyPreview = (result, resolvedConfig) => {
    if (!result.success) {
      setPreview({ status: 'error', message: result.message || 'Connection failed' });
      return;
    }
    const files = result.files || [];
    if (files.length === 0) {
      setPreview({
        status: 'warning',
        message: 'No recognized document-type folders found here — check the folder path and try again.',
        files,
        resolvedConfig,
      });
      return;
    }
    setPreview({
      status: 'success',
      message: `Ready to connect — the full file list with dates and sizes will be shown on the next step.`,
      files,
      resolvedConfig,
    });
  };

  const handleConnectAndSync = () => {
    if (preview?.status !== 'success') return;

    const auth =
      mode === MODE_ONLINE ? { accessToken: accessToken.trim() } : { username: username.trim(), password, domain: domain.trim() };

    const config = {
      ...preview.resolvedConfig,
      displayName: displayName.trim() || undefined,
    };

    // Online tokens are always cached (short-lived, low sensitivity); NTLM
    // passwords require explicit opt-in, matching the prior dialog's
    // behavior — remember is meaningless/ignored for the Online branch.
    onConnect({ config, auth, remember: mode === MODE_ONLINE ? true : rememberCredentials });
  };

  const handleModeChange = (_e, newMode) => {
    setMode(newMode);
    resetForNewCheck();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Connect to SharePoint</DialogTitle>
      <DialogContent>
        {/* The Graph access token field is type="password" — Chrome requires a
            <form> ancestor for password-type inputs, otherwise it logs a console
            warning that includes the field's live value (i.e. the raw token). */}
        <Box
          component="form"
          onSubmit={(e) => e.preventDefault()}
          sx={{ pt: 1 }}
        >
          <Tabs value={mode} onChange={handleModeChange} sx={{ mb: 2 }}>
            <Tab label='On-premises' value={MODE_ONPREM} />
            <Tab label='Online' value={MODE_ONLINE} />
          </Tabs>

          {mode === MODE_ONPREM ? (
            <>
              {!useManualEntry ? (
                <>
                  <TextField
                    fullWidth
                    label='Templates Folder URL *'
                    value={folderUrl}
                    onChange={(e) => {
                      setFolderUrl(e.target.value);
                      resetForNewCheck();
                    }}
                    placeholder='http://sp-server/sites/project/Shared Documents/Templates'
                    helperText='Paste the URL from your browser while viewing the templates folder in SharePoint'
                    sx={{ mb: 2 }}
                    autoFocus
                  />
                  <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
                    Farm not resolving this correctly?{' '}
                    <Link
                      component='button'
                      variant='caption'
                      onClick={() => {
                        setUseManualEntry(true);
                        resetForNewCheck();
                      }}
                    >
                      Enter Site URL / Library / Folder manually
                    </Link>
                  </Typography>
                </>
              ) : (
                <>
                  <TextField
                    fullWidth
                    label='Site URL *'
                    value={manualSiteUrl}
                    onChange={(e) => {
                      setManualSiteUrl(e.target.value);
                      resetForNewCheck();
                    }}
                    placeholder='http://sp-server/sites/project'
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label='Document Library *'
                    value={manualLibrary}
                    onChange={(e) => {
                      setManualLibrary(e.target.value);
                      resetForNewCheck();
                    }}
                    placeholder='Shared Documents'
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label='Folder Path *'
                    value={manualFolder}
                    onChange={(e) => {
                      setManualFolder(e.target.value);
                      resetForNewCheck();
                    }}
                    placeholder='02 Engineering/Templates'
                    sx={{ mb: 2 }}
                  />
                  <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
                    <Link
                      component='button'
                      variant='caption'
                      onClick={() => {
                        setUseManualEntry(false);
                        resetForNewCheck();
                      }}
                    >
                      Paste a folder URL instead
                    </Link>
                  </Typography>
                </>
              )}

              <TextField
                fullWidth
                label='Username *'
                autoComplete='username'
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  resetForNewCheck();
                }}
                placeholder='john.doe'
                helperText={
                  identityHint?.account
                    ? "Just the account name (e.g. jsmith) — no domain prefix. Enter the domain separately below. (pre-filled from Azure DevOps)"
                    : "Just the account name (e.g. jsmith) — no domain prefix. Enter the domain separately below."
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                type='password'
                label='Password *'
                autoComplete='current-password'
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  resetForNewCheck();
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label='Domain (Optional)'
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  resetForNewCheck();
                }}
                placeholder='COMPANY'
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberCredentials}
                    onChange={(e) => setRememberCredentials(e.target.checked)}
                  />
                }
                label='Remember credentials until you Disconnect (saved across browser restarts)'
                sx={{ mb: 1 }}
              />
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label='SharePoint / OneDrive Folder Link *'
                value={shareLink}
                onChange={(e) => {
                  setShareLink(e.target.value);
                  resetForNewCheck();
                }}
                placeholder='https://tenant.sharepoint.com/:f:/s/site/... or the browser address bar URL'
                helperText='Paste "Copy link" on the templates folder, or just the address bar URL after navigating into it'
                sx={{ mb: 2 }}
                autoFocus
              />

              <Alert severity='info' sx={{ mb: 2 }}>
                <Typography variant='body2'>
                  Paste a Microsoft Graph access token below. Get one from{' '}
                  <a href='https://developer.microsoft.com/graph/graph-explorer' target='_blank' rel='noreferrer'>
                    Graph Explorer
                  </a>{' '}
                  (sign in, run any query, copy from the "Access token" tab), or run:
                  <br />
                  <code>az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv</code>
                </Typography>
              </Alert>

              <TextField
                fullWidth
                type={showToken ? 'text' : 'password'}
                autoComplete='off'
                label='Microsoft Graph Access Token *'
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  resetForNewCheck();
                }}
                placeholder='eyJ0eXAiOiJKV1QiLCJhbGciOi...'
                helperText={tokenExpiryLabel ? `Token ${tokenExpiryLabel}` : 'Paste the access token here'}
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        aria-label='toggle token visibility'
                        onClick={() => setShowToken((s) => !s)}
                        edge='end'
                        size='small'
                      >
                        {showToken ? <VisibilityOff fontSize='small' /> : <Visibility fontSize='small' />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </>
          )}

          <TextField
            fullWidth
            label='Display Name (Optional)'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder='My SharePoint Templates'
            sx={{ mb: 2 }}
          />

          {preview && (
            <Alert severity={preview.status} sx={{ mb: 1 }}>
              {preview.message}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={checking}>
          Cancel
        </Button>
        <Button
          onClick={handleTestConnection}
          disabled={checking}
          startIcon={checking && <CircularProgress size={16} />}
        >
          {checking ? 'Checking...' : 'Test Connection'}
        </Button>
        <Button
          onClick={handleConnectAndSync}
          variant='contained'
          color='primary'
          disabled={preview?.status !== 'success'}
        >
          {canSync ? 'Connect & Sync' : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointConnectDialog;
