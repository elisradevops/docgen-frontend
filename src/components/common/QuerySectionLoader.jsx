import React from 'react';
import { Box, Stack, CircularProgress, Typography } from '@mui/material';

// Renders an overlayed, zero-height loader so it doesn't affect layout flow.
// Positioning relies on the loader's own wrapper; it occupies no height.
const QuerySectionLoader = ({ loading, text = 'Loading queries...' }) => {
  if (!loading) return null;
  return (
    <Box sx={{ position: 'relative', height: 0, minHeight: 0 }}>
      <Stack
        direction='row'
        alignItems='center'
        spacing={0.75}
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <CircularProgress size={14} />
        <Typography variant='caption' color='text.secondary'>
          {text}
        </Typography>
      </Stack>
    </Box>
  );
};

export default QuerySectionLoader;
