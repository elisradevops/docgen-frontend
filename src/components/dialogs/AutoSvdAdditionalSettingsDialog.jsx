import React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getInvalidEmails, getPipelineSetupExtrasErrors } from '../../lib/pipelineSetup/pipelineSetupExtras';

/**
 * Auto SVD's "everything with no Manual SVD equivalent" settings, grouped
 * into one dialog instead of three always-visible SectionCards — cuts down
 * scrolling on the SVD page (see AutoSvdPanel.jsx's "Additional settings"
 * SectionCard, which opens this and shows a one-line summary of what's set).
 *
 * Manual SVD is the baseline: includePullRequests/includeChangeDescription
 * are real Invoke-SvdGeneration.ps1 parameters, but Manual SVD's own
 * Pipeline/Release selectors (PipelineSelector.jsx/ReleaseSelector.jsx — the
 * only range types Auto SVD ever targets) don't expose them either, only
 * CommitDateSelector.jsx does. So they're deliberately left out here too, not
 * just hidden — see pipelineSetupExtras.js. Excluded repositories has no
 * Manual SVD equivalent at all (no selector exposes it), but it's kept —
 * it's a real, independently useful pipeline-setup option (e.g. excluding
 * pipeline-templates/DevOpsTemplates), not something Manual SVD's UI gaps
 * should gate.
 */

// Small "label + info icon" pair for controls without a helperText slot
// (FormControlLabel/Checkbox) — TextFields use MUI's own helperText instead.
const LabelWithInfo = ({ text, info }) => (
  <Stack
    direction='row'
    spacing={0.5}
    alignItems='center'
  >
    <span>{text}</span>
    <Tooltip
      title={info}
      arrow
      placement='right'
      componentsProps={{ tooltip: { sx: { maxWidth: 320 } } }}
    >
      <InfoOutlinedIcon
        fontSize='inherit'
        sx={{ color: 'text.secondary', cursor: 'help' }}
      />
    </Tooltip>
  </Stack>
);

const AutoSvdAdditionalSettingsDialog = ({ open, onClose, surface, extras, setExtra }) => {
  const errors = getPipelineSetupExtrasErrors(extras, surface);

  const invalidMailTo = extras.sendEmail ? getInvalidEmails(extras.mailTo) : [];
  const mailToError = !extras.mailTo?.trim()
    ? extras.sendEmail
      ? 'Required when email is on.'
      : ''
    : invalidMailTo.length > 0
      ? `Invalid address: ${invalidMailTo.join(', ')}`
      : '';

  const invalidMailCC = extras.sendEmail ? getInvalidEmails(extras.mailCC) : [];
  const mailCCError = invalidMailCC.length > 0 ? `Invalid address: ${invalidMailCC.join(', ')}` : '';

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        // "Done" is disabled below while errors exist (see DialogActions) —
        // without this guard, Escape/backdrop-click would silently bypass
        // that gate, since MUI's Dialog invokes onClose for those too.
        if (errors.length > 0 && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
        onClose();
      }}
      maxWidth='sm'
      fullWidth
    >
      <DialogTitle>Additional settings for Auto SVD</DialogTitle>
      <DialogContent>
        <Stack
          spacing={2}
          sx={{ pt: 0.5 }}
        >
          <Stack spacing={1}>
            <Typography
              variant='subtitle2'
              fontWeight={600}
            >
              Pipeline options
            </Typography>
            <TextField
              size='small'
              label='Excluded repositories'
              placeholder='pipeline-templates, DevOpsTemplates'
              helperText='Optional. Comma-separated repository names, exactly as they appear in Azure DevOps. Leave blank to use the backend’s default exclusion list.'
              value={extras.excludedRepoNames}
              onChange={(e) => setExtra('excludedRepoNames', e.target.value)}
              fullWidth
            />
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography
              variant='subtitle2'
              fontWeight={600}
            >
              Email
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={extras.sendEmail} onChange={(_e, c) => setExtra('sendEmail', c)} />}
              label={
                <LabelWithInfo
                  text='Email the generated SVD'
                  info='When on, Mail To becomes required and the pipeline sends the finished document by email.'
                />
              }
            />
            <Collapse
              in={extras.sendEmail}
              timeout='auto'
              unmountOnExit
            >
              <Stack spacing={1.25}>
                <TextField
                  size='small'
                  label='Mail to'
                  required
                  placeholder='team@example.com, other-team@example.com'
                  helperText={mailToError || 'Required. Comma-separated recipient email addresses.'}
                  error={!!mailToError}
                  value={extras.mailTo}
                  onChange={(e) => setExtra('mailTo', e.target.value)}
                  fullWidth
                />
                <TextField
                  size='small'
                  label='Mail CC'
                  placeholder='cc-team@example.com, other-cc@example.com'
                  helperText={mailCCError || 'Optional. Comma-separated CC email addresses.'}
                  error={!!mailCCError}
                  value={extras.mailCC}
                  onChange={(e) => setExtra('mailCC', e.target.value)}
                  fullWidth
                />
                <TextField
                  size='small'
                  label='Mail from'
                  placeholder='(script default)'
                  helperText='Optional override. By design, most setups should leave this blank — the pipeline’s configured sender address is used instead.'
                  value={extras.mailFrom}
                  onChange={(e) => setExtra('mailFrom', e.target.value)}
                  fullWidth
                />
                <TextField
                  size='small'
                  label='SMTP server'
                  placeholder='(script default)'
                  helperText='Optional override. By design, most setups should leave this blank — the pipeline’s configured SMTP relay is used instead.'
                  value={extras.smtpServer}
                  onChange={(e) => setExtra('smtpServer', e.target.value)}
                  fullWidth
                />
              </Stack>
            </Collapse>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography
              variant='subtitle2'
              fontWeight={600}
            >
              Artifactory
            </Typography>
            {surface === 'classicRelease' ? (
              <Stack spacing={1.25}>
                <FormControlLabel
                  control={
                    <Checkbox checked={extras.uploadToJfrog} onChange={(_e, c) => setExtra('uploadToJfrog', c)} />
                  }
                  label={
                    <LabelWithInfo
                      text='Upload to Artifactory'
                      info='When on, the script uploads the generated SVD to Artifactory. URL and repository are both optional — leave them blank to use the pipeline’s configured default location.'
                    />
                  }
                />
                <Collapse
                  in={extras.uploadToJfrog}
                  timeout='auto'
                  unmountOnExit
                >
                  <Stack spacing={1.25}>
                    <TextField
                      size='small'
                      label='Artifactory URL'
                      placeholder='(pipeline default)'
                      helperText='Optional. Base Artifactory URL (no trailing slash). Leave blank to use the pipeline’s configured default.'
                      value={extras.jfrogUrl}
                      onChange={(e) => setExtra('jfrogUrl', e.target.value)}
                      fullWidth
                    />
                    <TextField
                      size='small'
                      label='Artifactory repository'
                      placeholder='(pipeline default)'
                      helperText='Optional. Target Artifactory repository name. Leave blank to use the pipeline’s configured default.'
                      value={extras.jfrogRepo}
                      onChange={(e) => setExtra('jfrogRepo', e.target.value)}
                      fullWidth
                    />
                  </Stack>
                </Collapse>
              </Stack>
            ) : (
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={
                    <Checkbox checked={extras.publishJfrog} onChange={(_e, c) => setExtra('publishJfrog', c)} />
                  }
                  label={
                    <LabelWithInfo
                      text='Publish to Artifactory'
                      info="Uses the pipeline template's default Artifactory service connection (jfrog-artifactory) — no URL or repository field needed here; override the connection in the YAML itself if a different one is required."
                    />
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox checked={extras.jfrogBuildInfo} onChange={(_e, c) => setExtra('jfrogBuildInfo', c)} />
                  }
                  label={
                    <LabelWithInfo
                      text='Collect Artifactory build info'
                      info='Attaches Azure Pipelines build metadata (name/number) to the uploaded artifact in Artifactory.'
                    />
                  }
                />
              </Stack>
            )}
          </Stack>

          {errors.length > 0 && (
            <Alert severity='error'>
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Tooltip title={errors.length > 0 ? 'Fill in the required fields above first.' : ''}>
          <span>
            <Button
              onClick={onClose}
              disabled={errors.length > 0}
              variant='contained'
            >
              Done
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

export default AutoSvdAdditionalSettingsDialog;
