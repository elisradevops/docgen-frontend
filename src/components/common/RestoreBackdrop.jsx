import React from 'react';
import { Backdrop, CircularProgress, Typography, Stack } from '@mui/material';

/**
 * RestoreBackdrop
 * Lightweight shared overlay shown while a selector is restoring state.
 *
 * @param {Object} props
 * @param {boolean} props.open Whether the overlay is visible
 */
export default function RestoreBackdrop({ open, label }) {
  return (
    <Backdrop
      open={!!open}
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <Stack spacing={1} alignItems='center'>
        <CircularProgress color='inherit' />
        {label ? (
          <Typography variant='body2' sx={{ color: 'inherit', opacity: 0.9 }}>
            {label}
          </Typography>
        ) : null}
      </Stack>
    </Backdrop>
  );
}
