import React from 'react';
import PropTypes from 'prop-types';
import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import packageJson from '../../../package.json';

const AppLayout = ({ navigation, actions, children, maxWidth = 'xl' }) => {
  return (
    <Box
      sx={{
        height: '100vh', // Use vh instead of dvh for Edge 92 compatibility
        bgcolor: (theme) => theme.palette.background.default,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative', // Add for Edge 92 flex layout fix
      }}
    >
      <AppBar position='sticky' color='primary' elevation={0}>
        <Toolbar
          disableGutters
          sx={{
            minHeight: 72,
            px: { xs: 2, sm: 3 },
            gap: { xs: 2, md: 3 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>{navigation}</Box>
          {actions ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, sm: 1.5 },
              }}
            >
              {actions}
            </Box>
          ) : null}
        </Toolbar>
      </AppBar>
      <Container
        maxWidth={maxWidth}
        sx={{
          py: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, md: 3 },
          flex: '1 1 auto', // More explicit flex for Edge 92
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative', // Fix for Edge 92 flex children
        }}
      >
        {children}
      </Container>
      <Box
        component='footer'
        sx={{
          py: 1,
          px: { xs: 2, sm: 3 },
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: (theme) => theme.palette.background.paper,
          flexShrink: 0, // Prevent footer from shrinking in Edge 92
        }}
      >
        <Container maxWidth={maxWidth} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Typography variant='caption' color='text.secondary'>
            DocGen Frontend v{packageJson.version}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

AppLayout.propTypes = {
  navigation: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
  maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
};

export default AppLayout;
