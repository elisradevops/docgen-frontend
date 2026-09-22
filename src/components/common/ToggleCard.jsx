import React from 'react';
import { Box, Checkbox, Stack, Typography } from '@mui/material';

const toggleCardSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  p: 1.5,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75,
};

/**
 * Icon + title + description card with a trailing checkbox — extracted from
 * ChangeTableSelector.jsx's "Base Data" content-options grid so Auto SVD mode
 * (see AutoSvdPanel.jsx) renders the exact same option cards instead of a
 * plain checkbox list.
 */
const ToggleCard = ({ icon, title, description, checked, onChange, info = null }) => {
  const Icon = icon;
  return (
    <Box sx={toggleCardSx}>
      <Stack
        direction='row'
        alignItems='center'
        justifyContent='space-between'
      >
        <Stack
          direction='row'
          spacing={1}
          alignItems='center'
        >
          <Icon fontSize='small' />
          <Typography
            variant='subtitle2'
            fontWeight={600}
          >
            {title}
          </Typography>
          {info}
        </Stack>
        <Checkbox
          size='small'
          checked={checked}
          onChange={(_event, nextChecked) => onChange(nextChecked)}
        />
      </Stack>
      <Typography
        variant='caption'
        color='text.secondary'
      >
        {description}
      </Typography>
    </Box>
  );
};

export default ToggleCard;
