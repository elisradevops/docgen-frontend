import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';

const ActionBar = ({ start, end }) => {
  const hasStart = Boolean(start);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        justifyContent: hasStart ? 'space-between' : 'flex-start',
        gap: { xs: 1.25, md: 1.5 },
        py: { xs: 0.25, md: 0.5 },
      }}
    >
      {hasStart ? <Box sx={{ flex: 1, minWidth: 0 }}>{start}</Box> : null}
      {end ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: hasStart ? { xs: 'flex-start', md: 'flex-end' } : 'flex-start',
            gap: { xs: 1, md: 1.5 },
            flex: hasStart ? 'initial' : 1,
          }}
        >
          {end}
        </Box>
      ) : null}
    </Box>
  );
};

ActionBar.propTypes = {
  start: PropTypes.node,
  end: PropTypes.node,
};

export default ActionBar;
