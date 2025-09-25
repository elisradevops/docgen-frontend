import React from 'react';
import PropTypes from 'prop-types';
import { Box, Skeleton, Typography } from '@mui/material';

const LoadingState = ({
  title = 'Loading…',
  subtitle,
  rows = 5,
  columns = [1],
  height = 32,
  headerWidth = 200,
  dense = false,
}) => {
  const gap = dense ? 1 : 1.5;

  return (
    <Box
      sx={{
        p: dense ? 1 : 1.5,
        borderRadius: (theme) => theme.shape.borderRadius,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: (theme) => theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        gap,
      }}
    >
      <Box>
        <Typography variant='body2' color='text.secondary'>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant='caption' color='text.disabled'>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box
          key={`loading-row-${rowIndex}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap,
            width: '100%',
          }}
        >
          {columns.map((flexValue, colIndex) => {
            const flex = typeof flexValue === 'number' ? flexValue : 1;
            const width = typeof flexValue === 'string' ? flexValue : undefined;
            return (
              <Skeleton
                key={`loading-cell-${rowIndex}-${colIndex}`}
                variant='rounded'
                height={height}
                sx={{
                  flexGrow: width ? 0 : flex,
                  flexBasis: width ? width : undefined,
                  minWidth: width || 0,
                  width: width || 'auto',
                }}
              />
            );
          })}
        </Box>
      ))}
      <Skeleton variant='text' width={headerWidth} sx={{ mt: dense ? 0.5 : 1 }} />
    </Box>
  );
};

LoadingState.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  rows: PropTypes.number,
  columns: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  height: PropTypes.number,
  headerWidth: PropTypes.number,
  dense: PropTypes.bool,
};

export default LoadingState;
