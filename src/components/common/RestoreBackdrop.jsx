import React from 'react';
import { Backdrop, CircularProgress } from '@mui/material';

/**
 * RestoreBackdrop
 * Lightweight shared overlay shown while a selector is restoring state.
 *
 * @param {Object} props
 * @param {boolean} props.open Whether the overlay is visible
 */
export default function RestoreBackdrop({ open }) {
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
      <CircularProgress color='inherit' />
    </Backdrop>
  );
}
