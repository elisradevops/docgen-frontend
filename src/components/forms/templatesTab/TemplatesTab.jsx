import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Button as MuiButton,
} from '@mui/material';
import { Button, Table, Tooltip, Input, Space, Popconfirm } from 'antd';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import SettingsIcon from '@mui/icons-material/Settings';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { toast } from 'react-toastify';
import Highlighter from 'react-highlight-words';
import LoadingState from '../../common/LoadingState';
import SharePointConnectDialog from '../../dialogs/SharePointConnectDialog';
import SharePointConflictDialog from '../../dialogs/SharePointConflictDialog';
import {
  checkSharePointConflicts,
  syncSharePointTemplates,
  saveSharePointConfig,
  getSharePointConfig,
  testSharePointConnection,
  deleteSharePointConfig,
} from '../../../store/data/docManagerApi';
import { encryptForSession, decryptForSession, clearSessionKey } from '../../../utils/secureStorage';
import { decodeJwtExpirySeconds } from '../../../utils/graphToken';
import {
  HEALTH_CHECK_INTERVAL_MS,
  isOnlineSharePointUrl,
  readCachedSharePointAuth,
  describeConnectionHealth,
} from '../../../utils/sharePointConnectionHealth';
import logger from '../../../utils/logger';

const resolveProjectName = (selectedTeamProject) => {
  if (!selectedTeamProject) return 'shared';
  if (typeof selectedTeamProject === 'string') return selectedTeamProject || 'shared';
  // Handle object case: { key, text }
  return selectedTeamProject.text || selectedTeamProject.key || 'shared';
};

// A saved config's siteUrl/library/folder shape now varies: on-prem manual
// entry populates all three, on-prem paste-a-URL leaves library empty (see
// SharePointService.resolveSiteFromUrl), and Online leaves both empty (the
// pasted sharing link *is* the whole location). Filter out empty segments
// rather than rendering stray " → " separators for whichever fields a given
// config doesn't use.
const describeSharePointLocation = (config) => {
  let host = config.siteUrl;
  try {
    host = new URL(config.siteUrl).hostname;
  } catch {
    // Leave the raw siteUrl if it isn't a parseable URL for some reason.
  }
  return [host, config.library, config.folder].filter(Boolean).join(' → ');
};

const TemplatesTab = observer(({ store, selectedTeamProject }) => {
  const projectName = useMemo(() => resolveProjectName(selectedTeamProject), [selectedTeamProject]);
  const hasProject = projectName !== 'shared';

  // store.documentTypes lists every doc-generation tab, not just the ones
  // that sync from a SharePoint file template — Test-Reporter builds its
  // content from ADO test data with no .dotx/.docx involved at all (see
  // MainTabs.jsx's isTestReporterTab, which skips template selection for
  // it the same way). Exclude it here so the SharePoint dialog's guidance
  // and folder-name validation don't claim a "Test-Reporter/" subfolder is
  // valid when the backend's sync would reject it.
  const templateDocTypes = useMemo(
    () => (store.documentTypes || []).filter((dt) => String(dt).toLowerCase() !== 'test-reporter'),
    [store.documentTypes]
  );

  const [templates, setTemplates] = useState([]);
  const [deletingTemplateEtag, setDeletingTemplateEtag] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);
  const [spConfig, setSpConfig] = useState(null);
  const [spCredentials, setSpCredentials] = useState(null);
  // 'checking' | 'healthy' | 'unhealthy' | 'no-session'
  // Starts 'checking', not 'no-session' — the latter is a real verdict, and
  // defaulting to it made a brand-new successful connection show "No active
  // session" for the seconds before the first real check completes.
  const [connectionHealth, setConnectionHealth] = useState('checking');
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  const viewManuallyChangedRef = useRef(false);
  const [templateLibrary, setTemplateLibrary] = useState(() => (hasProject ? 'project' : 'shared'));

  useEffect(() => {
    // Keep the existing UX: selecting a project defaults to the project library.
    // Shared library remains always accessible via the toggle.
    if (!hasProject) {
      viewManuallyChangedRef.current = false;
      setTemplateLibrary('shared');
    } else if (!viewManuallyChangedRef.current) {
      setTemplateLibrary('project');
    }
  }, [hasProject, projectName]);

  // Sync only ever writes into a project's own template bucket — it must
  // never be reachable from the Standard (shared) templates view, even if a
  // project happens to be selected in the background.
  const canSyncTemplates = hasProject && templateLibrary === 'project';

  const refreshTemplates = useCallback(() => {
    const projectNameOverride = templateLibrary === 'shared' ? '' : undefined;
    store.fetchTemplatesListForDownload(projectNameOverride);
  }, [store, templateLibrary]);

  useEffect(() => {
    refreshTemplates();
  }, [projectName, refreshTemplates]);

  // The SharePoint connection is app-level (one per user), not per-project —
  // restore it regardless of whether a team project is currently selected.
  // Only the eventual sync target is project-scoped (see performSync).
  useEffect(() => {
    const loadSharePointConfig = async () => {
      try {
        const userId = store.userDetails?.name;
        if (!userId) return;
        const result = await getSharePointConfig(userId);
        if (result.success && result.config) {
          setSpConfig(result.config);
        }
      } catch {
        // Config not found, that's okay
        logger.debug('No SharePoint config found');
      }
    };
    loadSharePointConfig();
  }, [store, store.userDetails?.name]);

  useEffect(() => {
    const onRefresh = () => refreshTemplates();
    window.addEventListener('docgen:templates-refresh', onRefresh);
    return () => window.removeEventListener('docgen:templates-refresh', onRefresh);
  }, [refreshTemplates]);

  useEffect(() => {
    setTemplates(store.templateForDownload || []);
  }, [store.templateForDownload]);

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters, confirm) => {
    clearFilters();
    setSearchText('');
    confirm();
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div
        style={{ padding: 8 }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type='primary'
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size='small'
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters, confirm)}
            size='small'
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type='link'
            size='small'
            onClick={() => {
              close();
            }}
          >
            Close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
    onFilter: (value, record) => record[dataIndex]?.toString().toLowerCase().includes(value.toLowerCase()),
    filterDropdownProps: {
      onOpenChange(open) {
        if (open) {
          setTimeout(() => searchInput.current?.select(), 100);
        }
      },
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{
            backgroundColor: '#ffc069',
            padding: 0,
          }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });

  // SharePoint sync handlers
  const cacheAuth = async (auth, remember) => {
    if (auth.accessToken) {
      // Graph tokens are short-lived and low-sensitivity — always cached, no
      // opt-in. Stored in localStorage (not sessionStorage): the token's own
      // exp claim / the pre-flight connectivity check are what actually
      // decide whether it's still usable, so there's no reason to also
      // discard an otherwise-still-valid token just because the tab closed
      // or a new tab was opened — same storage posture as the NTLM
      // credentials below.
      const encrypted = await encryptForSession(JSON.stringify({ ...auth, timestamp: Date.now() }));
      localStorage.setItem('sharepoint_oauth_token', encrypted);
    } else if (remember) {
      // NTLM passwords require explicit opt-in before being persisted at
      // all — but unlike a bearer token, a password has no exp claim and
      // doesn't rotate on its own clock, so once opted in it's remembered
      // in localStorage (survives browser restarts) with no arbitrary time
      // cap. The pre-flight testSharePointConnection check is the actual
      // authority on whether it's still valid (password changed/locked).
      const encrypted = await encryptForSession(
        JSON.stringify({
          username: auth.username,
          password: auth.password,
          domain: auth.domain || '',
          timestamp: Date.now(),
        })
      );
      localStorage.setItem('sharepoint_credentials', encrypted);
    } else {
      localStorage.removeItem('sharepoint_credentials');
    }
  };

  const clearCachedSharePointAuth = () => {
    localStorage.removeItem('sharepoint_oauth_token');
    localStorage.removeItem('sharepoint_credentials');
  };

  const openConnectDialog = () => {
    setShowConnectDialog(true);
    store.fetchWindowsIdentityHint();
  };

  // Cheapest possible check (no file listing) that cached auth still works,
  // called right before reusing it for a sync — an expired/revoked token
  // used to only surface deep inside checkConflicts.
  const verifyCachedAuthStillValid = async (config, auth) => {
    try {
      const result = await testSharePointConnection(config.siteUrl, config.library, config.folder, auth);
      return !!result.success;
    } catch {
      return false;
    }
  };

  // Bump this to force an immediate re-check outside the normal spConfig /
  // interval triggers — needed right after cacheAuth() actually finishes
  // writing a freshly-connected credential to storage, since that happens
  // asynchronously after setSpConfig() and would otherwise race this effect
  // (it could re-run on the spConfig change and read storage before the new
  // token is written, land on 'no-session', and then not correct itself
  // until the next interval tick).
  const [healthCheckNonce, setHealthCheckNonce] = useState(0);

  // Live connection health: the card used to just show green whenever a
  // config was saved, regardless of whether the cached credential still
  // actually works. Check once on load, then on an interval, so a token that
  // expires mid-session gets reflected instead of staying stale-green.
  useEffect(() => {
    if (!spConfig) {
      setConnectionHealth('no-session');
      return;
    }

    let cancelled = false;

    const checkHealth = async () => {
      // Set synchronously, before the first await — otherwise the card
      // keeps showing whatever status it had before this run (often the
      // stale/default 'no-session') for the whole duration of the storage
      // read + network verification below.
      setConnectionHealth('checking');
      const cached = await readCachedSharePointAuth();
      if (cancelled) return;
      if (!cached) {
        setConnectionHealth('no-session');
        return;
      }
      if (cached.expiredLocally) {
        // Graph token's own exp claim already says it's dead — no need to
        // spend a network call finding that out.
        setConnectionHealth('unhealthy');
        return;
      }
      const stillValid = await verifyCachedAuthStillValid(spConfig, cached.auth);
      if (cancelled) return;
      setConnectionHealth(stillValid ? 'healthy' : 'unhealthy');
    };

    checkHealth();
    const intervalId = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [spConfig, healthCheckNonce]);

  const handleSharePointSync = async () => {
    // Sync only targets a project's own templates — never the shared library.
    if (!canSyncTemplates) {
      toast.error(
        hasProject
          ? 'Switch to "Project templates" to sync from SharePoint'
          : 'Please select a project before syncing templates'
      );
      return;
    }

    if (spConfig) {
      // Try to use cached OAuth token first (for SharePoint Online)
      const cachedTokenRaw = localStorage.getItem('sharepoint_oauth_token');

      if (cachedTokenRaw) {
        try {
          const tokenData = JSON.parse(await decryptForSession(cachedTokenRaw));

          // Check the token's REAL remaining lifetime (its exp claim), not
          // an arbitrary fixed window — a JWT with 55 minutes left is fine
          // to reuse; one with 3 minutes left is not, regardless of the
          // old hardcoded 1-hour guess. If the token can't be decoded
          // (opaque/non-JWT), don't gate on a guess at all — let the
          // pre-flight testSharePointConnection check below be the judge.
          const remainingSeconds = decodeJwtExpirySeconds(tokenData.accessToken);
          const isRecent = remainingSeconds === null || remainingSeconds > 60;

          if (isRecent && tokenData.accessToken) {
            const auth = { accessToken: tokenData.accessToken };
            setSyncing(true);
            const stillValid = await verifyCachedAuthStillValid(spConfig, auth);
            if (stillValid) {
              proceedWithAuth(spConfig, auth);
            } else {
              setSyncing(false);
              clearCachedSharePointAuth();
              toast.info('Your SharePoint session expired — please reconnect.');
              openConnectDialog();
            }
            return;
          }
        } catch {
          // Decrypt/parse failure -> treat as no usable cache, not an error.
          localStorage.removeItem('sharepoint_oauth_token');
        }
      }

      // Try to use cached NTLM credentials (for on-premise SharePoint) —
      // localStorage, no time cap: a password doesn't expire on its own
      // clock the way a token does, so the pre-flight check below (not a
      // local timestamp guess) is the sole authority on whether it's stale.
      const cachedCredsRaw = localStorage.getItem('sharepoint_credentials');

      if (cachedCredsRaw) {
        try {
          const creds = JSON.parse(await decryptForSession(cachedCredsRaw));

          if (creds.username && creds.password) {
            const auth = { username: creds.username, password: creds.password, domain: creds.domain || '' };
            setSyncing(true);
            const stillValid = await verifyCachedAuthStillValid(spConfig, auth);
            if (stillValid) {
              proceedWithAuth(spConfig, auth);
            } else {
              setSyncing(false);
              clearCachedSharePointAuth();
              toast.info('Your SharePoint session expired — please reconnect.');
              openConnectDialog();
            }
            return;
          }
        } catch (error) {
          // If parsing/decryption fails, fall through to show the connect dialog
          logger.warn('Failed to parse cached SharePoint credentials:', error);
        }
      }
    }

    // No config yet, or no usable cached auth — show the connect dialog
    // (prefilled from spConfig when one already exists, for re-auth).
    openConnectDialog();
  };

  const handleConnectDialogSubmit = async ({ config, auth, remember }) => {
    try {
      const userId = store.userDetails?.name;

      await saveSharePointConfig(userId, config.siteUrl, config.library, config.folder, config.displayName);

      setSpConfig(config);
      setShowConnectDialog(false);
      try {
        await cacheAuth(auth, remember);
      } catch (err) {
        logger.warn('Could not cache SharePoint auth (crypto unavailable?); continuing without cache', err);
        // The connection itself still works (auth is held in memory for
        // this sync), but nothing was written to storage — every future
        // health check will correctly, but silently, read as "no session".
        // Say so up front instead of leaving that looking like a bug.
        toast.warning(
          "Connected, but this browser can't securely store the session — you'll need to reconnect after refreshing.",
          { autoClose: 8000 }
        );
      }
      // The credential is now actually written to storage — force a fresh
      // health check rather than leaving it to whatever the spConfig-change
      // effect happened to read mid-write, or the next interval tick.
      setHealthCheckNonce((n) => n + 1);

      if (!canSyncTemplates) {
        // Connection saved (app-level); no valid sync target right now —
        // the dialog already showed "Connect" rather than "Connect & Sync"
        // for this case, so don't attempt a sync or surface its error toast.
        toast.success('SharePoint connection saved. Select a project to sync templates.');
        return;
      }

      // Pass config/auth explicitly (not read back from state) — setSpConfig
      // above hasn't necessarily flushed yet in this same synchronous flow.
      await proceedWithAuth(config, auth);
    } catch (error) {
      toast.error(`Failed to connect: ${error.message}`);
      logger.error('SharePoint connect failed:', error);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await deleteSharePointConfig(store.userDetails?.name);
      setSpConfig(null);
      clearCachedSharePointAuth();
      try {
        await clearSessionKey();
      } catch (err) {
        logger.warn('Could not clear the persisted SharePoint encryption key; caches were still cleared', err);
      }
      toast.success('SharePoint connection removed.');
    } catch (error) {
      toast.error(`Failed to disconnect: ${error.message}`);
      logger.error('SharePoint disconnect failed:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  const proceedWithAuth = async (config, auth) => {
    // Single chokepoint for every path into a sync (the "Sync from SharePoint"
    // button, and "Edit SharePoint connection" → Connect & Sync) — the
    // connection itself is app-level and editable without a project, but an
    // actual sync always needs the Project templates view active.
    if (!canSyncTemplates) {
      toast.error(
        hasProject
          ? 'Switch to "Project templates" to sync from SharePoint'
          : 'Please select a project before syncing templates'
      );
      return;
    }
    try {
      setSpCredentials(auth);

      // Check for conflicts
      setSyncing(true);
      const bucketName = 'templates';
      const currentProjectName = resolveProjectName(selectedTeamProject);
      const docType = store.docType || '';

      const result = await checkSharePointConflicts({
        siteUrl: config.siteUrl,
        library: config.library,
        folder: config.folder,
        auth,
        bucketName,
        projectName: currentProjectName,
        docType,
      });

      setSyncing(false);

      if (result.success) {
        // Show warning for invalid docTypes (consolidated)
        if (result.invalidFiles && result.invalidFiles.length > 0) {
          toast.warning(
            `${result.invalidFiles.length} file(s) skipped due to invalid docType: ${result.invalidFiles.map(f => f.name).join(', ')}. Valid types are: STD, STP, STR, SVD, SRS, SYSRS`,
            { autoClose: 8000 }
          );
        }

        const reviewableCount = (result.newFiles?.length || 0) + (result.conflicts?.length || 0);
        if (reviewableCount > 0) {
          // Always show the review table — covers both conflicting and
          // brand-new files, so nothing syncs without the user seeing it
          // first (previously, a sync with zero conflicts skipped review
          // entirely and synced every new file with no visibility).
          setConflictData(result);
          setShowConflictDialog(true);
        } else {
          // Nothing to review (e.g. everything already identical) — proceed directly.
          performSync([], auth, config);
        }
      }
    } catch (error) {
      setSyncing(false);
      toast.error(`Failed to check conflicts: ${error.message}`);
      logger.error('SharePoint conflict check failed:', error);
    }
  };

  const handleConflictResolution = (filesToSkip, docTypeOverrides) => {
    setShowConflictDialog(false);
    performSync(filesToSkip, spCredentials, spConfig, docTypeOverrides);
  };

  const performSync = async (filesToSkip, credentials, config, docTypeOverrides) => {
    try {
      setSyncing(true);
      const bucketName = 'templates';
      const currentProjectName = resolveProjectName(selectedTeamProject);
      const docType = store.docType || '';

      // Use passed config/credentials, fallback to state if not provided
      // (handleConflictResolution's later, separate render already has
      // flushed state, so it can rely on the fallback).
      const configToUse = config || spConfig;
      const authToUse = credentials || spCredentials;

      const result = await syncSharePointTemplates({
        siteUrl: configToUse.siteUrl,
        library: configToUse.library,
        folder: configToUse.folder,
        auth: authToUse,
        bucketName,
        projectName: currentProjectName,
        docType,
        skipFiles: filesToSkip,
        docTypeOverrides,
      });

      setSyncing(false);

      if (result.success) {
        // Build a clear message about what happened
        const syncedCount = result.syncedFiles.length;
        const failedCount = result.failedFiles?.length || 0;
        const identicalCount = result.identicalFiles?.length || 0;
        
        // Build message parts
        const parts = [];
        if (syncedCount > 0) {
          parts.push(`${syncedCount} synced`);
        }
        if (identicalCount > 0) {
          parts.push(`${identicalCount} skipped (already up-to-date)`);
        }
        if (failedCount > 0) {
          parts.push(`${failedCount} failed`);
        }
        
        const message = parts.length > 0 
          ? `Templates: ${parts.join(', ')}`
          : 'No templates to sync';
        
        if (failedCount > 0) {
          toast.warning(message, { autoClose: 5000 });
        } else if (syncedCount > 0) {
          toast.success(message, { autoClose: 3000 });
        } else if (identicalCount > 0) {
          toast.info(message, { autoClose: 3000 });
        } else {
          toast.info(message, { autoClose: 3000 });
        }
        
        // Refresh templates list (respect the current library view)
        refreshTemplates();
        if (templateLibrary === 'shared' && hasProject) {
          toast.info('Sync completed. Switch to "Project templates" to see synced files.', { autoClose: 4000 });
        }
      }
    } catch (error) {
      setSyncing(false);
      toast.error(`Sync failed: ${error.message}`);
      logger.error('SharePoint sync failed:', error);
    }
  };

  const handleTemplateDelete = (template) => {
    const templateName = template.name.split('/').pop();
    // Prevent deletion of shared templates at the UI level
    if (template.name.startsWith('shared/')) {
      toast.error('Deleting shared templates is not allowed.');
      return;
    }
    setDeletingTemplateEtag(template.etag);
    store
      .deleteFileObject(template, 'templates')
      .then(() => {
        toast.success(`Template "${templateName}" deleted successfully`);
        // If the deleted template is currently selected, clear it and inform the user
        if (store.selectedTemplate?.url === template.url) {
          try {
            store.setSelectedTemplate(null);
            toast.info('The deleted template was selected and has been cleared.');
          } catch (e) {
            // Non-blocking UX: log but avoid breaking flow
            console.warn('Failed to clear selected template after deletion:', e);
          }
        }
        // If shared, inform about global impact
        if (template.name.startsWith('shared/')) {
          toast.warn('A shared template was deleted. This affects all projects that use it.');
        }
      })
      .catch((err) => {
        toast.error(`Error while deleting template ${templateName}: ${err.message}`, { autoClose: false });
      })
      .finally(() => {
        setDeletingTemplateEtag(null);
        refreshTemplates();
      });
  };

  const columns = [
    {
      title: 'Template File',
      dataIndex: 'name',
      key: 'name',
      ...getColumnSearchProps('name'),
      render: (text, record) => {
        const content =
          searchedColumn === 'name' ? (
            <Highlighter
              highlightStyle={{
                backgroundColor: '#ffc069',
                padding: 0,
              }}
              searchWords={[searchText]}
              autoEscape
              textToHighlight={text ? text.toString() : ''}
            />
          ) : (
            text
          );
        return <a href={record.url}>{content}</a>;
      },
      sorter: (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      key: 'lastModified',
      // Prefer the source system's (SharePoint's) modified date when the template was
      // synced; fall back to MinIO's storage timestamp for manual uploads and for
      // templates synced before sourceLastModified was recorded.
      sorter: (a, b) =>
        new Date(a.sourceLastModified || a.lastModified) - new Date(b.sourceLastModified || b.lastModified),
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => new Date(record?.sourceLastModified || text).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => {
        const isShared = record.name.startsWith('shared/');
        const fileName = record.name.split('/').pop();
        const isCurrentlySelected = store.selectedTemplate?.url === record.url;
        // For shared templates, hide deletion by disabling the action
        if (isShared) {
          return (
            <Tooltip title='Shared templates cannot be deleted'>
              <Button
                icon={<DeleteOutlined />}
                danger
                disabled
              />
            </Tooltip>
          );
        }
        return (
          <Popconfirm
            title={`Delete template "${fileName}"?`}
            description={(() => {
              const notes = [];
              if (isCurrentlySelected)
                notes.push('It is currently selected and will be unselected after deletion');
              notes.push('This action cannot be undone');
              return notes.join('. ') + '.';
            })()}
            okText='Delete'
            cancelText='Cancel'
            okButtonProps={{ danger: true, loading: deletingTemplateEtag === record.etag }}
            onConfirm={() => handleTemplateDelete(record)}
          >
            <Tooltip title='Delete Template'>
              <Button
                loading={deletingTemplateEtag === record.etag}
                icon={<DeleteOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Alert severity='info' sx={{ flexShrink: 0 }}>
        View project templates or standard templates (shared) without clearing the selected Team Project.
      </Alert>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <ToggleButtonGroup
          color='primary'
          size='small'
          value={templateLibrary}
          exclusive
          onChange={(_e, next) => {
            if (!next) return;
            viewManuallyChangedRef.current = true;
            setTemplateLibrary(next);
          }}
          aria-label='template library view'
        >
          <ToggleButton
            value='project'
            disabled={!hasProject}
            aria-label='project templates'
          >
            Project templates
          </ToggleButton>
          <ToggleButton
            value='shared'
            aria-label='standard templates'
          >
            Standard templates
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ flex: 1, minWidth: 260 }}
        >
          {templateLibrary === 'shared'
            ? `Showing the shared library${hasProject ? ` (project "${projectName}" remains selected)` : ''}.`
            : `Showing templates for project "${projectName}".`}
        </Typography>
      </Box>
      
      {/* The SharePoint connection itself is app-level — shown and editable
          regardless of project selection. Only the Sync action needs the
          Project templates view active, since that's what synced files land in. */}
      <Box sx={{ display: 'flex', gap: 2, flexShrink: 0, flexWrap: 'wrap' }}>
        {canSyncTemplates ? (
          <MuiButton
            variant="contained"
            startIcon={<CloudSyncIcon />}
            onClick={handleSharePointSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync from SharePoint'}
          </MuiButton>
        ) : (
          <Alert severity="warning" sx={{ flexShrink: 0 }}>
            {hasProject
              ? '⚠️ Switch to "Project templates" to sync from SharePoint'
              : '⚠️ Select a project first to sync templates from SharePoint'}
          </Alert>
        )}
        <Tooltip title="Edit SharePoint connection">
          <MuiButton
            variant="outlined"
            onClick={openConnectDialog}
            sx={{ minWidth: 0, px: 1.5 }}
            aria-label="Edit SharePoint connection"
          >
            <SettingsIcon fontSize="small" />
          </MuiButton>
        </Tooltip>
        {spConfig ? (
          <Alert
            severity={describeConnectionHealth(connectionHealth).severity}
            sx={{ flex: 1, alignItems: 'center', '& .MuiAlert-message': { minWidth: 0, overflow: 'hidden' } }}
            action={
              <MuiButton
                size="small"
                variant="outlined"
                color="error"
                startIcon={<LinkOffIcon fontSize="small" />}
                onClick={handleDisconnect}
                disabled={disconnecting}
                sx={{ flexShrink: 0 }}
              >
                {disconnecting ? 'Removing...' : 'Disconnect'}
              </MuiButton>
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600 }}
              >
                {spConfig.displayName || 'SharePoint connected'}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={isOnlineSharePointUrl(spConfig.siteUrl) ? 'Online' : 'On-premises'}
                sx={{ height: 20 }}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block' }}
            >
              {describeSharePointLocation(spConfig)}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{ display: 'block', fontWeight: 500 }}
            >
              {describeConnectionHealth(connectionHealth).message}
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ flex: 1 }}>
            Click "Sync from SharePoint" to configure your SharePoint source
          </Alert>
        )}
      </Box>

      {store.loadingState.templatesLoadingState ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <LoadingState title='Fetching templates' columns={[3, 2, '96px']} />
        </Box>
      ) : (
        <Paper
          variant='outlined'
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: (theme) => theme.palette.background.paper,
            '& .ant-table-wrapper': { borderRadius: 0 },
            '& .ant-table-container': { borderRadius: 0 },
            '& .ant-table-content': { borderRadius: 0 },
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 0, md: 1 } }}>
            <Table
              loading={false}
              columns={columns}
              dataSource={templates.map((row, index) => ({
                ...row,
                key: row.name || index,
              }))}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} templates`,
              }}
            />
          </Box>
        </Paper>
      )}

      {/* SharePoint Dialogs */}
      <SharePointConnectDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        onConnect={handleConnectDialogSubmit}
        initialConfig={spConfig}
        identityHint={store.windowsIdentityHint}
        canSync={canSyncTemplates}
        documentTypes={templateDocTypes}
      />

      <SharePointConflictDialog
        open={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        onProceed={handleConflictResolution}
        conflicts={conflictData?.conflicts || []}
        newFiles={conflictData?.newFiles || []}
        totalFiles={conflictData?.totalFiles || 0}
        documentTypes={templateDocTypes}
        truncated={conflictData?.truncated}
        skippedFolders={conflictData?.skippedFolders || []}
      />
    </Stack>
  );
});

export default TemplatesTab;
