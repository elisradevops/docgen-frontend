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
  Popper,
  Paper,
  Stack,
  Fade,
  Chip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import { resolveSharePointUrl, listSharePointFiles } from '../../store/data/docManagerApi';
import { resolveIdentityPrefill } from './sharePointIdentityPrefill';
import { isOnlineSharePointUrl as isOnlineUrl } from '../../utils/sharePointConnectionHealth';
import { buildFolderPreviewMessage } from './sharePointFolderPreview';
import { isSecureStorageAvailable } from '../../utils/secureStorage';
import { signIn as signInWithMicrosoft, getSessionInfo } from '../../utils/sharePointSession';
import logger from '../../utils/logger';
import { colors } from '../../theme/tokens';

const MODE_ONPREM = 'onprem';
const MODE_ONLINE = 'online';

// Shown inside the folder-structure hint when no project is selected yet
// (so store.documentTypes is empty) — illustrative only, not validated
// against.
const EXAMPLE_DOC_TYPES = ['STD', 'SVD', 'SRS'];

// Made-up filenames for the one illustrated example folder — chosen to look
// nothing alike on purpose, so "filenames can be anything" is shown, not
// just stated.
const EXAMPLE_FILES = ['Acme_STD_v3.dotx', 'Legacy Format.docx'];

const FolderStructureHintContent = ({ documentTypes }) => {
  const hasRealTypes = documentTypes && documentTypes.length > 0;
  const types = hasRealTypes ? documentTypes : EXAMPLE_DOC_TYPES;

  return (
    <Box sx={{ maxWidth: 300 }}>
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 700, mb: 0.25 }}
      >
        Expected folder layout
      </Typography>
      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ display: 'block', mb: 1 }}
      >
        Same for On-premises and Online — the folder you connect to needs one subfolder per template type:
      </Typography>

      {/* The full hierarchy, root through every real doc type — not one
          detached example — so it's visible that every subfolder listed
          is a direct child of the one folder you're pointing at, not a
          disconnected set of accepted names. */}
      <Stack
        spacing={0.4}
        sx={{ mb: 1.5 }}
      >
        <Stack
          direction='row'
          alignItems='center'
          spacing={0.75}
        >
          <FolderOutlinedIcon
            fontSize='small'
            sx={{ color: 'text.secondary' }}
          />
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ fontStyle: 'italic' }}
          >
            (the folder you connect to)
          </Typography>
        </Stack>
        {types.map((dt, i) => (
          <React.Fragment key={dt}>
            <Stack
              direction='row'
              alignItems='center'
              spacing={0.75}
              sx={{ pl: 3 }}
            >
              <FolderOutlinedIcon
                fontSize='small'
                color='primary'
              />
              <Typography
                variant='body2'
                sx={{ fontWeight: 700, fontFamily: '"Roboto Mono", Consolas, monospace' }}
              >
                {dt}/
              </Typography>
            </Stack>
            {/* Files illustrated under only the first folder — enough to
                show "any filename works", without repeating it per type. */}
            {i === 0 &&
              EXAMPLE_FILES.map((fileName) => (
                <Stack
                  key={fileName}
                  direction='row'
                  alignItems='center'
                  spacing={0.75}
                  sx={{ pl: 6 }}
                >
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 15 }} color='disabled' />
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ fontFamily: '"Roboto Mono", Consolas, monospace' }}
                  >
                    {fileName}
                  </Typography>
                </Stack>
              ))}
          </React.Fragment>
        ))}
      </Stack>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ display: 'block' }}
      >
        <Box
          component='span'
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          Only the subfolder name matters.
        </Box>{' '}
        Filenames can be anything, and multiple templates per type are welcome — you'll choose which one to use
        later.
        {!hasRealTypes && ' Example types shown — the real set depends on the selected project.'}
      </Typography>
    </Box>
  );
};

// Hover-triggered info affordance for the folder-URL fields. Deliberately a
// themed Popper + Paper rather than MUI's Tooltip — Tooltip renders with a
// fixed dark bubble regardless of the app's palette, which is the right
// choice for a one-line label but reads as generic/unstyled for a content
// block like this; Paper picks up the app's real background/elevation/radius.
const FolderStructureInfoButton = ({ documentTypes }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const closeTimerRef = useRef(null);

  const openFromIcon = (e) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setAnchorEl(e.currentTarget);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  };
  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setAnchorEl(null), 120);
  };

  return (
    <>
      <IconButton
        aria-label='Expected folder structure'
        edge='end'
        size='small'
        onMouseEnter={openFromIcon}
        onMouseLeave={scheduleClose}
        onFocus={openFromIcon}
        onBlur={scheduleClose}
      >
        <InfoOutlinedIcon fontSize='small' />
      </IconButton>
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement='bottom-end'
        transition
        sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
        modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      >
        {({ TransitionProps }) => (
          <Fade
            {...TransitionProps}
            timeout={120}
          >
            <Paper
              elevation={4}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              sx={{ p: 2, borderRadius: 2 }}
            >
              <FolderStructureHintContent documentTypes={documentTypes} />
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
};

/**
 * Single "Connect to SharePoint" dialog — replaces the old two-step
 * SharePointConfigDialog -> SharePointCredentialsDialog handoff. One mode
 * tab switch (On-premises / Online), only the active mode's fields shown,
 * a live "Test Connection" preview (reusing the real listTemplateFiles
 * backend call, so the same file filtering/validation applies here as at
 * sync time) that must succeed before "Connect & Sync" is enabled.
 */
const SharePointConnectDialog = ({
  open,
  onClose,
  onConnect,
  initialConfig,
  identityHint,
  canSync = true,
  documentTypes = [],
}) => {
  // Online is the default for a brand-new connection — it's the current,
  // security-reviewed path (delegated sign-in, no shared passwords). A
  // saved config still opens to whatever type it already is; only the
  // no-config case defaults forward. See the effect below.
  const [mode, setMode] = useState(MODE_ONLINE);

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

  // Online — authenticates via a Backend-For-Frontend OAuth session (a
  // popup sign-in), not a pasted token. `sessionInfo` is null until a
  // sign-in completes; `signingIn` drives the button's loading state.
  const [shareLink, setShareLink] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null); // { status: 'success'|'warning'|'error', message, files, resolvedConfig }

  // Scan progress feedback — the actual scan is one request/response, not
  // streaming, so there's no real per-file progress to show. This is
  // purely a client-side elapsed-time readout so a deep/wide folder tree
  // (which can take several seconds) doesn't look identical to a hang.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!checking) {
      setElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    // Computed from a fixed start time, not incremented per tick — an
    // incrementing counter drifts under background-tab timer throttling.
    const intervalId = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [checking]);

  useEffect(() => {
    if (!open) return;
    setMode(!initialConfig || isOnlineUrl(initialConfig.siteUrl) ? MODE_ONLINE : MODE_ONPREM);
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

  // Best-effort: on open, check whether a Microsoft sign-in session already
  // exists (e.g. from an earlier connect this browser session) so the user
  // isn't asked to sign in again unnecessarily. A failure here just means
  // "not signed in yet" — the Sign in button below handles that normally,
  // so no error state is surfaced for this specific check.
  useEffect(() => {
    if (!open) {
      setSessionInfo(null);
      return;
    }
    let cancelled = false;
    getSessionInfo()
      .then((info) => {
        if (!cancelled && info?.success) setSessionInfo(info);
      })
      .catch(() => {
        /* not signed in yet — normal, no error to surface */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const resetForNewCheck = () => setPreview(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signInWithMicrosoft();
      const info = await getSessionInfo();
      if (info?.success) {
        setSessionInfo(info);
      } else {
        throw new Error('Sign-in did not complete');
      }
    } catch (error) {
      // error.message is already the friendly, user-facing copy (see
      // authPopup.js's describeAuthError) — the raw code/description is
      // logged here for diagnosability without ever reaching the dialog.
      logger.error('SharePoint Online sign-in failed:', error.code, error.description || error.message);
      setSignInError(error.message || 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  };

  const handleTestConnection = async () => {
    setChecking(true);
    setPreview(null);

    try {
      if (mode === MODE_ONLINE) {
        if (!shareLink.trim()) throw new Error('Paste a SharePoint/OneDrive folder link');
        if (!sessionInfo) throw new Error('Sign in with Microsoft first');

        const result = await listSharePointFiles(shareLink.trim(), '', '');
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
      setPreview({ status: 'error', canConnect: false, message: error.message });
    } finally {
      setChecking(false);
    }
  };

  const applyPreview = (result, resolvedConfig) => {
    if (!result.success) {
      setPreview({ status: 'error', canConnect: false, message: result.message || 'Connection failed' });
      return;
    }
    const files = result.files || [];
    const { status, canConnect, message } = buildFolderPreviewMessage({
      files,
      documentTypes,
      truncated: result.truncated,
      skippedFolders: result.skippedFolders,
    });
    setPreview({ status, canConnect, message, files, resolvedConfig });
  };

  const handleConnectAndSync = () => {
    if (!preview?.canConnect) return;

    const config = {
      ...preview.resolvedConfig,
      displayName: displayName.trim() || undefined,
    };

    // Online mode has nothing to hand back here — the session lives
    // server-side (see sharePointSession.js). `auth`/`remember` are
    // on-prem-only now.
    if (mode === MODE_ONLINE) {
      onConnect({ config });
      return;
    }

    const auth = { username: username.trim(), password, domain: domain.trim() };
    onConnect({ config, auth, remember: rememberCredentials });
  };

  const handleModeChange = (_e, newMode) => {
    setMode(newMode);
    setSignInError(null);
    resetForNewCheck();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Connect to SharePoint</DialogTitle>
      <DialogContent>
        {/* The on-prem Password field below is type="password" — Chrome requires
            a <form> ancestor for password-type inputs, otherwise it logs a
            console warning that includes the field's live value. */}
        <Box
          component="form"
          onSubmit={(e) => e.preventDefault()}
          sx={{ pt: 1 }}
        >
          <Tabs value={mode} onChange={handleModeChange} sx={{ mb: 1 }}>
            <Tab
              value={MODE_ONLINE}
              icon={<CloudOutlinedIcon fontSize='small' />}
              iconPosition='start'
              label={
                <Stack direction='row' alignItems='center' spacing={1}>
                  <span>Online</span>
                  <Chip
                    label='Recommended'
                    size='small'
                    sx={{
                      height: 20,
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      bgcolor: colors.secondary,
                      color: colors.textPrimary,
                    }}
                  />
                </Stack>
              }
            />
            <Tab value={MODE_ONPREM} icon={<DnsOutlinedIcon fontSize='small' />} iconPosition='start' label='On-premises' />
          </Tabs>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 3 }}>
            {mode === MODE_ONLINE
              ? 'Sign in with your Microsoft account — always current, no shared passwords.'
              : 'For connections to an internal, on-premises SharePoint network only. Requires domain credentials.'}
          </Typography>

          {!isSecureStorageAvailable() && (
            <Alert severity='info' sx={{ mb: 3 }}>
              This browser can't remember your session here — it requires a secure (HTTPS) connection to DocGen.
              You'll be reconnected for the current tab, but will need to reconnect after refreshing. Ask your
              admin about enabling HTTPS if you'd like this to persist.
            </Alert>
          )}

          {mode === MODE_ONPREM ? (
            <>
              {/* Credentials first, location second — mirrors the Online tab
                  (sign in, then say where) and matches reality: the folder
                  URL can't be resolved without credentials either (see
                  handleTestConnection's resolveSharePointUrl call below). */}
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
                sx={{ mb: 3 }}
                autoFocus={!identityHint?.account}
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
                sx={{ mb: 3 }}
                autoFocus={!!identityHint?.account}
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
                sx={{ mb: 3 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberCredentials}
                    onChange={(e) => setRememberCredentials(e.target.checked)}
                  />
                }
                label='Remember credentials until you Disconnect (saved across browser restarts)'
                sx={{ mb: 3 }}
              />

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
                    sx={{ mb: 3 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <FolderStructureInfoButton documentTypes={documentTypes} />
                        </InputAdornment>
                      ),
                    }}
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
                    sx={{ mb: 3 }}
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
                    sx={{ mb: 3 }}
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
                    sx={{ mb: 3 }}
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
            </>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                {sessionInfo ? (
                  <Alert
                    severity='success'
                    icon={<CheckCircleOutlineIcon fontSize='inherit' />}
                    action={
                      <Link component='button' variant='body2' onClick={handleSignIn} sx={{ whiteSpace: 'nowrap' }}>
                        Switch account
                      </Link>
                    }
                    sx={{ alignItems: 'center' }}
                  >
                    Signed in as {sessionInfo.displayName || sessionInfo.userPrincipalName}
                  </Alert>
                ) : (
                  <Button
                    variant='outlined'
                    onClick={handleSignIn}
                    disabled={signingIn}
                    startIcon={signingIn && <CircularProgress size={16} />}
                    autoFocus
                  >
                    {signingIn ? `Signing in… ${elapsedSeconds}s` : 'Sign in with Microsoft'}
                  </Button>
                )}
                {signInError && (
                  <Alert severity='error' sx={{ mt: 1 }}>
                    {signInError}
                  </Alert>
                )}
              </Box>

              <TextField
                fullWidth
                label='SharePoint / OneDrive Folder Link *'
                value={shareLink}
                onChange={(e) => {
                  setShareLink(e.target.value);
                  resetForNewCheck();
                }}
                placeholder='https://tenant.sharepoint.com/:f:/s/site/... or the browser address bar URL'
                helperText={
                  sessionInfo
                    ? 'Paste "Copy link" on the templates folder, or just the address bar URL after navigating into it'
                    : 'Sign in with Microsoft above before testing the connection'
                }
                sx={{ mb: 3 }}
                disabled={!sessionInfo}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <FolderStructureInfoButton documentTypes={documentTypes} />
                    </InputAdornment>
                  ),
                }}
              />
            </>
          )}

          {/* Shared across both tabs — visually separated with a divider so
              it reads as connection metadata, not the last field of
              whichever tab happens to be open. */}
          <Box sx={{ pt: 3, mb: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <TextField
              fullWidth
              label='Display Name (Optional)'
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder='My SharePoint Templates'
            />
          </Box>

          {checking && (
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
              {elapsedSeconds > 15
                ? 'Still scanning — this folder has a lot of subfolders.'
                : 'Scanning folders — larger or deeper structures can take longer.'}
            </Typography>
          )}

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
          disabled={
            checking ||
            (mode === MODE_ONLINE && !sessionInfo) ||
            (mode === MODE_ONPREM && (!username.trim() || !password))
          }
          startIcon={checking && <CircularProgress size={16} />}
        >
          {checking ? `Checking… ${elapsedSeconds}s` : 'Test Connection'}
        </Button>
        <Button
          onClick={handleConnectAndSync}
          variant='contained'
          color='primary'
          disabled={!preview?.canConnect}
        >
          {canSync ? 'Connect & Sync' : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharePointConnectDialog;
