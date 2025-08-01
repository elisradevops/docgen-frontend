import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Generic component for displaying a single settings section
 * @param {String} title - Section title
 * @param {Array} settings - Array of setting strings to display
 * @param {String} emptyMessage - Message to show when no settings are enabled
 * @param {Object} boxProps - Additional props for the container Box
 * @param {Object} titleProps - Additional props for the title Typography
 * @param {Object} contentProps - Additional props for the content Typography
 */
const SettingsDisplay = ({
  title,
  settings = [],
  emptyMessage = 'No settings enabled',
  boxProps = {},
  titleProps = {},
  contentProps = {},
}) => {
  const hasSettings = settings && settings.length > 0;

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'grey.50',
        borderRadius: 1,
        height: 'fit-content',
        ...boxProps,
      }}
    >
      <Typography
        variant='subtitle1'
        color='primary'
        sx={{ fontWeight: 'bold', mb: 1, ...titleProps }}
      >
        {title}
      </Typography>
      <Typography
        variant='body2'
        color='textSecondary'
        sx={{
          whiteSpace: 'pre-line',
          lineHeight: 1.6,
          ...contentProps,
        }}
      >
        {hasSettings ? settings.join('\n') : emptyMessage}
      </Typography>
    </Box>
  );
};

export default SettingsDisplay;
