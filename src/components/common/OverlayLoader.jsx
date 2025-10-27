import React from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

const OverlayLoader = ({ loading, text = 'Loading queries...' }) => {
  if (!loading) return null;
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(6px) saturate(120%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
   >
      <Box
        sx={{
          px: 1.75,
          py: 1,
          borderRadius: 2,
          bgcolor: (theme) => theme.palette.background.paper,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          boxShadow: (theme) => theme.shadows[3],
        }}
      >
        <Stack direction='row' alignItems='center' spacing={1.25}>
          <CircularProgress size={22} />
          {text ? (
            <Typography variant='subtitle2' sx={{ fontWeight: 600 }} color='text.primary'>
              {text}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
};

export default OverlayLoader;
