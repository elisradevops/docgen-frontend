import React from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Typography, Stack, Divider, Switch, FormControlLabel } from '@mui/material';

const SectionCard = ({
  title,
  description,
  actions,
  enableToggle,
  enabled = true,
  onToggle,
  children,
  compact = false,
}) => {
  const hasMeta = title || description || actions || enableToggle;
  return (
    <Paper
      variant='outlined'
      sx={{
        borderRadius: 1.5,
        p: { xs: 1.5, md: compact ? 1.75 : 2 },
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 1 : 1.5,
        opacity: enableToggle && !enabled ? 0.65 : 1,
      }}
    >
      {hasMeta ? (
        <Stack
          direction='row'
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent='space-between'
          spacing={1}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <Typography
                variant='subtitle1'
                sx={{ fontWeight: 600, mb: description ? 0.25 : 0 }}
              >
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography variant='body2' color='text.secondary'>
                {description}
              </Typography>
            ) : null}
          </Box>
          <Stack direction='row' spacing={1} alignItems='center'>
            {actions}
            {enableToggle ? (
              <FormControlLabel
                control={<Switch size='small' checked={enabled} onChange={onToggle} />}
                label={enableToggle}
              />
            ) : null}
          </Stack>
        </Stack>
      ) : null}
      {hasMeta ? <Divider /> : null}
      <Box sx={{ opacity: enableToggle && !enabled ? 0.5 : 1 }}>{children}</Box>
    </Paper>
  );
};

SectionCard.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  actions: PropTypes.node,
  enableToggle: PropTypes.node,
  enabled: PropTypes.bool,
  onToggle: PropTypes.func,
  children: PropTypes.node.isRequired,
  compact: PropTypes.bool,
};

export default SectionCard;
