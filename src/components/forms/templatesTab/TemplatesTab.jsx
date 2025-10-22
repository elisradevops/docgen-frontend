import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react';
import { Alert, Box, Paper, Stack, Button as MuiButton } from '@mui/material';
import { Button, Table, Tooltip, Input, Space, Popconfirm } from 'antd';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { toast } from 'react-toastify';
import Highlighter from 'react-highlight-words';
import LoadingState from '../../common/LoadingState';
import SharePointConfigDialog from '../../dialogs/SharePointConfigDialog';
import SharePointCredentialsDialog from '../../dialogs/SharePointCredentialsDialog';
import SharePointConflictDialog from '../../dialogs/SharePointConflictDialog';
import {
  checkSharePointConflicts,
  syncSharePointTemplates,
  saveSharePointConfig,
  getSharePointConfig,
} from '../../../store/data/docManagerApi';
import logger from '../../../utils/logger';

const TemplatesTab = observer(({ store, selectedTeamProject }) => {
  const [templates, setTemplates] = useState([]);
  const [deletingTemplateEtag, setDeletingTemplateEtag] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);
  const [spConfig, setSpConfig] = useState(null);
  const [spCredentials, setSpCredentials] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  // Helper to get project name string from selectedTeamProject (which might be object or string)
  const getProjectName = () => {
    if (!selectedTeamProject) return 'shared';
    if (typeof selectedTeamProject === 'string') return selectedTeamProject;
    // Handle object case: { key, text }
    return selectedTeamProject.text || selectedTeamProject.key || 'shared';
  };

  // Load SharePoint configuration for this project
  const loadSharePointConfig = async () => {
    try {
      const projectName = getProjectName();
      const userId = store.userDetails?.name;
      const result = await getSharePointConfig(userId, projectName);
      if (result.success && result.config) {
        setSpConfig(result.config);
      }
    } catch {
      // Config not found, that's okay
      logger.debug('No SharePoint config found for this project');
    }
  };

  useEffect(() => {
    store.fetchTemplatesListForDownload();
    loadSharePointConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamProject, store]);

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
  const handleSharePointSync = () => {
    // Validate project is selected (not 'shared' default)
    const projectName = getProjectName();
    if (!selectedTeamProject || projectName === 'shared') {
      toast.error('Please select a project before syncing templates');
      return;
    }
    
    if (!spConfig) {
      setShowConfigDialog(true);
    } else {
      // Try to use cached OAuth token first (for SharePoint Online)
      const cachedToken = sessionStorage.getItem('sharepoint_oauth_token');
      
      if (cachedToken) {
        try {
          const tokenData = JSON.parse(cachedToken);
          
          // Check if cached token is recent (within 1 hour for safety)
          const ONE_HOUR = 60 * 60 * 1000;
          const isRecent = tokenData.timestamp && (Date.now() - tokenData.timestamp) < ONE_HOUR;
          
          if (isRecent && tokenData.accessToken) {
            // Use cached OAuth token
            const oauthToken = {
              accessToken: tokenData.accessToken,
              expiresIn: tokenData.expiresIn,
              tokenType: tokenData.tokenType,
            };
            
            // Silently use cached auth - no toast needed
            handleCredentialsSubmit(oauthToken);
            return;
          }
        } catch {
          // If parsing fails, clear invalid token and continue
          sessionStorage.removeItem('sharepoint_oauth_token');
        }
      }
      
      // Try to use cached NTLM credentials (for on-premise SharePoint)
      const cachedCreds = sessionStorage.getItem('sharepoint_credentials');
      
      if (cachedCreds) {
        try {
          const creds = JSON.parse(cachedCreds);
          
          // Check if cached credentials are recent (within 8 hours)
          const EIGHT_HOURS = 8 * 60 * 60 * 1000;
          const isRecent = creds.timestamp && (Date.now() - creds.timestamp) < EIGHT_HOURS;
          
          if (isRecent && creds.username && creds.password) {
            // Decode password and use cached credentials
            const credentials = {
              username: creds.username,
              password: atob(creds.password),
              domain: creds.domain || '',
            };
            
            // Silently use cached credentials - no toast needed
            handleCredentialsSubmit(credentials);
            return;
          }
        } catch (error) {
          // If parsing fails, fall through to show credentials dialog
          logger.warn('Failed to parse cached SharePoint credentials:', error);
        }
      }
      
      // No cached credentials or they're old - show credentials dialog
      setShowCredentialsDialog(true);
    }
  };

  const handleConfigSubmit = async (config) => {
    try {
      const projectName = getProjectName();
      const userId = store.userDetails?.name;
      
      await saveSharePointConfig(
        userId,
        projectName,
        config.siteUrl,
        config.library,
        config.folder,
        config.displayName
      );
      
      setSpConfig(config);
      setShowConfigDialog(false);
      // Config saved - no toast needed, credentials dialog will show
      setShowCredentialsDialog(true);
    } catch (error) {
      toast.error(`Failed to save configuration: ${error.message}`);
    }
  };

  const handleCredentialsSubmit = async (credentials) => {
    try {
      setSpCredentials(credentials);
      setShowCredentialsDialog(false);
      
      // Check for conflicts
      setSyncing(true);
      const bucketName = 'templates';
      const projectName = getProjectName();
      const docType = store.docType || '';
      
      const result = await checkSharePointConflicts(
        spConfig.siteUrl,
        spConfig.library,
        spConfig.folder,
        credentials,
        bucketName,
        projectName,
        docType
      );
      
      setSyncing(false);
      
      if (result.success) {
        // Show warning for invalid docTypes (consolidated)
        if (result.invalidFiles && result.invalidFiles.length > 0) {
          toast.warning(
            `${result.invalidFiles.length} file(s) skipped due to invalid docType: ${result.invalidFiles.map(f => f.name).join(', ')}. Valid types are: STD, STR, SVD, SRS`,
            { autoClose: 8000 }
          );
        }
        
        if (result.conflicts && result.conflicts.length > 0) {
          // Show conflict resolution dialog
          setConflictData(result);
          setShowConflictDialog(true);
        } else {
          // No conflicts, proceed directly - pass credentials to avoid state timing issue
          performSync([], credentials);
        }
      }
    } catch (error) {
      setSyncing(false);
      toast.error(`Failed to check conflicts: ${error.message}`);
      logger.error('SharePoint conflict check failed:', error);
    }
  };

  const handleConflictResolution = (filesToSkip) => {
    setShowConflictDialog(false);
    performSync(filesToSkip, spCredentials);
  };

  const performSync = async (filesToSkip, credentials) => {
    try {
      setSyncing(true);
      const bucketName = 'templates';
      const projectName = getProjectName();
      const docType = store.docType || '';
      
      // Use passed credentials parameter, fallback to state if not provided
      const authToUse = credentials || spCredentials;
      
      const result = await syncSharePointTemplates(
        spConfig.siteUrl,
        spConfig.library,
        spConfig.folder,
        authToUse,
        bucketName,
        projectName,
        docType,
        filesToSkip
      );
      
      setSyncing(false);
      
      if (result.success) {
        // Consolidate success and failure into one toast
        const syncedCount = result.syncedFiles.length;
        const failedCount = result.failedFiles?.length || 0;
        const totalCount = result.totalFiles;
        
        if (failedCount > 0) {
          toast.warning(
            `Synced ${syncedCount} of ${totalCount} templates. ${failedCount} file(s) failed - check logs for details.`,
            { autoClose: 5000 }
          );
        } else {
          toast.success(
            `Successfully synced ${syncedCount} of ${totalCount} templates`,
            { autoClose: 3000 }
          );
        }
        // Refresh templates list
        store.fetchTemplatesListForDownload();
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
        store.fetchTemplatesListForDownload();
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
      sorter: (a, b) => new Date(a.lastModified) - new Date(b.lastModified),
      sortDirections: ['ascend', 'descend'],
      render: (text) => new Date(text).toLocaleString(),
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
        Select a project to view its templates or leave it blank to see the shared library.
      </Alert>
      
      {(!selectedTeamProject || getProjectName() === 'shared') ? (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>
          ⚠️ Select a project first to sync templates from SharePoint
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <MuiButton
            variant="contained"
            startIcon={<CloudSyncIcon />}
            onClick={handleSharePointSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync from SharePoint'}
          </MuiButton>
          {spConfig ? (
            <Alert severity="success" sx={{ flex: 1 }}>
              <Box>
                <strong>📁 SharePoint Location:</strong>
                <br />
                {spConfig.displayName && (
                  <>
                    <strong>{spConfig.displayName}</strong>
                    <br />
                  </>
                )}
                <span style={{ fontSize: '0.9em' }}>
                  {new URL(spConfig.siteUrl).hostname} → {spConfig.library} → {spConfig.folder}
                </span>
              </Box>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ flex: 1 }}>
              Click "Sync from SharePoint" to configure your SharePoint source
            </Alert>
          )}
        </Box>
      )}

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
      <SharePointConfigDialog
        open={showConfigDialog}
        onClose={() => setShowConfigDialog(false)}
        onSubmit={handleConfigSubmit}
        userId={store.userDetails?.name}
      />

      <SharePointCredentialsDialog
        open={showCredentialsDialog}
        onClose={() => setShowCredentialsDialog(false)}
        onSubmit={handleCredentialsSubmit}
        siteUrl={spConfig?.siteUrl}
      />

      <SharePointConflictDialog
        open={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        onProceed={handleConflictResolution}
        conflicts={conflictData?.conflicts || []}
        newFiles={conflictData?.newFiles || []}
        totalFiles={conflictData?.totalFiles || 0}
      />
    </Stack>
  );
});

export default TemplatesTab;
