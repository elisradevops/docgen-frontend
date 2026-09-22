import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { copyToClipboard } from '../../utils/clipboard';

const CodeBlock = ({ code, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box>
      <Stack
        direction='row'
        justifyContent='flex-end'
        sx={{ mb: 0.5 }}
      >
        <Button
          size='small'
          variant='outlined'
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
        >
          {copied ? 'Copied' : `Copy ${label}`}
        </Button>
      </Stack>
      <Typography
        component='pre'
        variant='body2'
        sx={{
          m: 0,
          p: 1.5,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          bgcolor: 'grey.900',
          color: 'grey.100',
          borderRadius: 1.5,
          maxHeight: 320,
          overflow: 'auto',
        }}
      >
        {code}
      </Typography>
    </Box>
  );
};

/**
 * Shows the ready-to-paste Classic Release PowerShell block or YAML template
 * block for Automated SVD, built directly from the SVD picker's own
 * selections (see src/lib/pipelineSetup). Never calls docgen-api-gate and
 * never triggers document generation.
 */
const PipelineSetupResultDialog = ({ open, onClose, surface, result }) => {
  if (!result) return null;
  const { code, checklist, errors, resourcesScaffold } = result;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{surface === 'classicRelease' ? 'Classic Release — PowerShell task script' : 'YAML — template call'}</span>
        <IconButton
          onClick={onClose}
          size='small'
        >
          <CloseIcon fontSize='small' />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {errors?.length > 0 ? (
            <Alert severity='warning'>
              {errors.map((err) => (
                <div key={err}>{err}</div>
              ))}
            </Alert>
          ) : null}

          <Box>
            <Typography
              variant='subtitle2'
              sx={{ fontWeight: 700, mb: 0.75 }}
            >
              Setup checklist
            </Typography>
            <Stack
              component='ol'
              spacing={0.75}
              sx={{ m: 0, pl: 2.5 }}
            >
              {checklist.map((step) => (
                <Typography
                  key={step}
                  component='li'
                  variant='body2'
                >
                  {step}
                </Typography>
              ))}
            </Stack>
          </Box>

          {resourcesScaffold ? (
            <>
              <Divider />
              <Box>
                <Typography
                  variant='subtitle2'
                  sx={{ fontWeight: 700, mb: 0.75 }}
                >
                  resources: scaffold
                </Typography>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ display: 'block', mb: 0.75 }}
                >
                  Required once per YAML pipeline that tracks a build for a pipeline-range SVD.
                </Typography>
                <CodeBlock
                  code={resourcesScaffold}
                  label='scaffold'
                />
              </Box>
            </>
          ) : null}

          <Divider />
          <Box>
            <Typography
              variant='subtitle2'
              sx={{ fontWeight: 700, mb: 0.75 }}
            >
              {surface === 'classicRelease' ? 'PowerShell task script' : 'Template call'}
            </Typography>
            <CodeBlock
              code={code}
              label='snippet'
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PipelineSetupResultDialog;
