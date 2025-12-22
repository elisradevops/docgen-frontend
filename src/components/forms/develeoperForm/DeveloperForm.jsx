import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';

import { contentTypeOptions } from '../../../store/data/dropDownOptions';

import {
  Box,
  Select,
  Switch,
  TextField,
  Button,
  MenuItem,
  FormControlLabel,
  Stack,
  Paper,
  Typography,
  Divider,
  Alert,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartAutocomplete from '../../common/SmartAutocomplete';

import TestContentSelector from '../../common/table/TestContentSelector';
import QueryContentSelector from '../../common/selectors/QueryContentSelector';
import TraceTableSelector from '../../common/selectors/TraceTableSelector';
import ChangeTableSelector from '../../common/table/ChangeTableSelector';
import fileDownload from 'js-file-download';
import STRTableSelector from '../../common/table/STRTableSelector';
import SharePointConfigManager from '../../dialogs/SharePointConfigManager';

const DeveloperForm = observer(({ store }) => {
  const [contentControlTitle, setContentControlTitle] = useState(null);
  const [contentControlType, setContentControlType] = useState('');
  const [contentControlSkin, setContentControlSkin] = useState('');
  const [showConfigManager, setShowConfigManager] = useState(false);

  useEffect(() => {
    if (!store.showDebugDocs) {
      setShowConfigManager(false);
    }
  }, [store, store.showDebugDocs]);

  const addToDocumentRequestObject = (contentControlObject) => {
    store.addContentControlToDocument(contentControlObject);
  };

  return (
    <Stack
      spacing={3}
      sx={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        pr: { xs: 0, md: 0.5 },
      }}
    >
      {/* SharePoint Configuration Management Section (debug only) */}
      {store.showDebugDocs ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant='h6' component='h2'>
              SharePoint Configuration Management
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Manage SharePoint connections for template synchronization across all projects.
            </Typography>
          </Box>

          <Divider sx={{ borderColor: (theme) => theme.palette.divider }} />

          <Alert severity="info" sx={{ mb: 1 }}>
            Configure SharePoint sources for each project. Users can sync templates from these configured locations.
          </Alert>

          <Box>
            <Button
              variant='contained'
              startIcon={<SettingsIcon />}
              onClick={() => setShowConfigManager(true)}
            >
              Manage SharePoint Configurations
            </Button>
          </Box>
        </Paper>
      ) : null}

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={3}
        alignItems='stretch'
        sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box>
              <Typography variant='h6' component='h2'>
                Build Content Controls
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Scaffold a request payload before sending it to DocGen.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={!!store.showDebugDocs}
                  onChange={(_e, checked) => store.setShowDebugDocs(!!checked)}
                />
              }
              label='Show debug doc types'
            />
          </Box>

          <Divider sx={{ borderColor: (theme) => theme.palette.divider }} />

          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label='Document Title'
              required
              placeholder='Example: STD'
              onChange={(event) => {
                store.setDocumentTitle(event.target.value);
              }}
            />

            <SmartAutocomplete
              disableClearable
              sx={{ width: '100%' }}
              autoHighlight
              openOnFocus
              options={store.templateList.map((template) => ({ url: template.url, text: template.name }))}
              label='Template'
              placeholder='Search templates'
              onChange={async (_e, newValue) => {
                store.setSelectedTemplate(newValue);
              }}
            />

            <TextField
              fullWidth
              label='Content Control Name'
              required
              placeholder='Example: system-capabilities'
              onChange={(event) => {
                setContentControlTitle(event.target.value);
              }}
            />

            {contentControlTitle ? (
              <Stack spacing={2.5}>
                <Typography variant='subtitle2' color='text.secondary'>
                  Content Control Type
                </Typography>
                <Select
                  fullWidth
                  value={`${contentControlType}|${contentControlSkin}`}
                  displayEmpty
                  renderValue={(selected) => {
                    if (!selected || selected === '|') {
                      return 'Pick data type and skin';
                    }
                    const match = contentTypeOptions.find((option) => {
                      const v = `${option.value.dataType}|${option.value.skinType}`;
                      return v === selected;
                    });
                    return match ? match.label : 'Pick data type and skin';
                  }}
                  onChange={(event) => {
                    const [dt, sk] = String(event.target.value || '').split('|');
                    setContentControlType(dt || '');
                    setContentControlSkin(sk || '');
                  }}
                >
                  <MenuItem value='|'>Pick data type and skin</MenuItem>
                  {contentTypeOptions.map((option, key) => {
                    const v = `${option.value.dataType}|${option.value.skinType}`;
                    return (
                      <MenuItem
                        key={key}
                        value={v}
                      >
                        {option.label}
                      </MenuItem>
                    );
                  })}
                </Select>

                {contentControlType === 'test' && contentControlSkin === 'test-std' ? (
                  <TestContentSelector
                    store={store}
                    contentControlTitle={contentControlTitle}
                    type={contentControlType}
                    skin={contentControlSkin}
                    editingMode={true}
                    addToDocumentRequestObject={addToDocumentRequestObject}
                  />
                ) : null}
                {contentControlSkin === 'test-str' ? (
                  <STRTableSelector
                    store={store}
                    contentControlTitle={contentControlTitle}
                    type={contentControlType}
                    skin={contentControlSkin}
                    editingMode={false}
                    addToDocumentRequestObject={store.addContentControlToDocument}
                  />
                ) : null}
                {contentControlType === 'query' ? (
                  <QueryContentSelector
                    contentControlTitle={contentControlTitle}
                    teamProjectName={store.teamProject}
                    type={contentControlType}
                    skin={contentControlSkin}
                    sharedQueriesList={store.sharedQueries}
                    contentControlArrayCell={null}
                    editingMode={true}
                    addToDocumentRequestObject={addToDocumentRequestObject}
                  />
                ) : null}
                {contentControlSkin === 'trace-table' ? (
                  <TraceTableSelector
                    store={store}
                    contentControlTitle={contentControlTitle}
                    contentControlArrayCell={null}
                    editingMode={true}
                    addToDocumentRequestObject={addToDocumentRequestObject}
                  />
                ) : null}
                {contentControlSkin === 'change-table' ? (
                  <ChangeTableSelector
                    store={store}
                    type={contentControlType}
                    skin={contentControlSkin}
                    contentControlTitle={contentControlTitle}
                    editingMode={true}
                    addToDocumentRequestObject={addToDocumentRequestObject}
                  />
                ) : null}
              </Stack>
            ) : null}

            <Box>
              <Button
                variant='contained'
                onClick={() => {
                  store.sendRequestToDocGen();
                }}
              >
                Send To Document Generator
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            flex: 1,
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Typography variant='h6' component='h2'>
            Request Preview
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Review or download the JSON we will send to the backend.
          </Typography>
          <TextField
            fullWidth
            label='Request JSON'
            multiline
            minRows={12}
            value={`${JSON.stringify(store.requestJson, null, 2)}`}
            InputProps={{ readOnly: true }}
            sx={{
              flex: 1,
              '& textarea': {
                fontFamily: 'monospace',
                fontSize: '0.85rem',
              },
            }}
          />
          <Box>
            <Button
              variant='outlined'
              onClick={() => {
                fileDownload(JSON.stringify(store.requestJson, null, 2), 'request.json');
              }}
            >
              Download Request JSON
            </Button>
          </Box>
        </Paper>
      </Stack>

      {/* SharePoint Configuration Manager Dialog (debug only) */}
      {store.showDebugDocs ? (
        <SharePointConfigManager
          open={showConfigManager}
          onClose={() => setShowConfigManager(false)}
          userId={store.userDetails?.name}
          currentProject={store.teamProject}
        />
      ) : null}
    </Stack>
  );
});

export default DeveloperForm;
